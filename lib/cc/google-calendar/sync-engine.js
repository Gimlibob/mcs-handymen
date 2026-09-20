/**
 * Google Calendar sync engine (GC-1).
 * MCS Job state is committed first by callers; this layer never rolls back MCS.
 */

import { getSql } from "../db/client.js";
import {
  getConnectedGoogleCalendar,
  getLatestGoogleCalendarConnection,
  setConnectionStatus,
} from "../db/google-calendar-connections.js";
import { getJobById } from "../db/jobs.js";
import { logLeadActivity } from "../db/leads.js";
import { getWorkerById } from "../db/workers.js";
import { getCustomerById } from "../db/customers.js";
import { buildGoogleCalendarEventPayload } from "../domain/google-calendar-event-payload.js";
import { GoogleCalendarProviderError } from "./provider.js";
import { safeJobSyncError } from "./safe-errors.js";
import { resolveGoogleCalendarProvider } from "./get-provider.js";

const ERROR_MAX = 240;

/**
 * Map auth / calendar-missing provider failures onto connection status.
 * Never throws.
 */
async function noteConnectionSideEffects(err, provider, calendarId) {
  try {
    if (!(err instanceof GoogleCalendarProviderError)) return;

    if (err.status === 401) {
      const conn = await getLatestGoogleCalendarConnection();
      if (conn && conn.status !== "disconnected") {
        await setConnectionStatus(
          conn.id,
          "revoked",
          "Google Calendar authorization expired"
        );
      }
      return;
    }

    if (err.status === 404 || err.code === "not_found") {
      if (!provider || typeof provider.getCalendar !== "function" || !calendarId) {
        return;
      }
      try {
        await provider.getCalendar({ calendarId });
      } catch (calErr) {
        if (
          calErr instanceof GoogleCalendarProviderError &&
          (calErr.status === 404 || calErr.code === "not_found")
        ) {
          const conn = await getLatestGoogleCalendarConnection();
          if (conn) {
            await setConnectionStatus(
              conn.id,
              "error",
              "MCS Jobs calendar not found"
            );
          }
        }
      }
    }
  } catch {
    // never break MCS path
  }
}

function requireSql() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  return sql;
}

function sanitizeError(err) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "unknown_error";
  const code =
    err && typeof err === "object" && "status" in err && err.status
      ? `HTTP ${err.status}: `
      : err && typeof err === "object" && "code" in err && err.code
        ? `${err.code}: `
        : "";
  const combined = `${code}${msg}`.replace(/\s+/g, " ").trim();
  return combined.slice(0, ERROR_MAX);
}

function errorClass(err) {
  if (err instanceof GoogleCalendarProviderError) {
    if (err.status === 404 || err.code === "not_found") return "not_found";
    if (err.status === 401) return "unauthorized";
    if (err.status === 403) return "forbidden";
    if (err.status === 429) return "rate_limited";
    if (err.code === "not_configured") return "not_configured";
    if (typeof err.status === "number" && err.status >= 500) return "server_error";
    return "provider_error";
  }
  return "unknown";
}

async function logSyncFailed({ leadId, jobId, operation, err }) {
  if (!leadId) return;
  try {
    await logLeadActivity({
      leadId,
      eventType: "google_calendar_sync_failed",
      message: `Google Calendar sync failed (${operation})`,
      meta: {
        jobId,
        operation,
        errorClass: errorClass(err),
      },
      createdBy: "system",
    });
  } catch {
    // never break MCS path
  }
}

async function updateJobGoogleSync(jobId, fields) {
  const sql = requireSql();
  const status = fields.google_sync_status ?? null;
  const eventId =
    fields.google_event_id === undefined ? undefined : fields.google_event_id;
  const error =
    fields.google_sync_error === undefined ? undefined : fields.google_sync_error;
  const attempts =
    fields.google_sync_attempts === undefined
      ? undefined
      : fields.google_sync_attempts;
  const syncedAt =
    fields.google_synced_at === undefined ? undefined : fields.google_synced_at;

  // Build update carefully with neon fragments
  if (eventId !== undefined && syncedAt === "now" && status === "synced") {
    await sql`
      UPDATE jobs SET
        google_event_id = ${eventId},
        google_sync_status = ${status},
        google_synced_at = now(),
        google_sync_error = NULL,
        google_sync_attempts = ${attempts ?? 0},
        updated_at = now()
      WHERE id = ${jobId}
    `;
    return;
  }

  if (eventId !== undefined && status === "none") {
    await sql`
      UPDATE jobs SET
        google_event_id = NULL,
        google_sync_status = 'none',
        google_synced_at = NULL,
        google_sync_error = NULL,
        google_sync_attempts = ${attempts ?? 0},
        updated_at = now()
      WHERE id = ${jobId}
    `;
    return;
  }

  if (status === "pending") {
    await sql`
      UPDATE jobs SET
        google_sync_status = 'pending',
        google_sync_error = NULL,
        updated_at = now()
      WHERE id = ${jobId}
    `;
    return;
  }

  if (status === "missing_remote") {
    await sql`
      UPDATE jobs SET
        google_sync_status = 'missing_remote',
        google_sync_error = ${error},
        google_sync_attempts = ${attempts ?? 0},
        updated_at = now()
      WHERE id = ${jobId}
    `;
    return;
  }

  if (status === "error") {
    await sql`
      UPDATE jobs SET
        google_sync_status = 'error',
        google_sync_error = ${error},
        google_sync_attempts = ${attempts ?? 0},
        updated_at = now()
      WHERE id = ${jobId}
    `;
    return;
  }

  if (status === "synced" && eventId !== undefined) {
    await sql`
      UPDATE jobs SET
        google_event_id = ${eventId},
        google_sync_status = 'synced',
        google_synced_at = now(),
        google_sync_error = NULL,
        google_sync_attempts = 0,
        updated_at = now()
      WHERE id = ${jobId}
    `;
  }
}

async function loadJobContext(jobId) {
  const job = await getJobById(jobId);
  if (!job) return null;
  const customer = await getCustomerById(job.customer_id).catch(() => null);
  let workerName = job.assigned_worker_name || null;
  if (!workerName && job.assigned_worker_id) {
    const w = await getWorkerById(job.assigned_worker_id).catch(() => null);
    workerName = w?.display_name || null;
  }
  return {
    job,
    customerName: customer?.full_name || job.customer_name || null,
    workerName,
  };
}

/**
 * Sync a scheduled (or dated) Job to Google.
 * @param {string} jobId
 * @param {{ provider?: import('./provider.js').GoogleCalendarProvider }} [opts]
 */
export async function syncScheduledJobToGoogle(jobId, opts = {}) {
  try {
    const connection = await getConnectedGoogleCalendar();
    if (!connection) {
      return { ok: true, skipped: "not_connected" };
    }

    const ctx = await loadJobContext(jobId);
    if (!ctx) return { ok: false, error: "not_found" };

    const { job, customerName, workerName } = ctx;
    if (!job.scheduled_date) {
      return { ok: true, skipped: "no_scheduled_date" };
    }
    if (job.status === "authorized") {
      return { ok: true, skipped: "not_scheduled_status" };
    }

    const provider = opts.provider || (await resolveGoogleCalendarProvider());
    const attempts = (job.google_sync_attempts || 0) + 1;
    await updateJobGoogleSync(jobId, { google_sync_status: "pending" });

    const cancelled = job.status === "cancelled";
    const payload = buildGoogleCalendarEventPayload({
      job,
      customerName,
      workerName,
      cancelled,
    });
    if (!payload) {
      await updateJobGoogleSync(jobId, {
        google_sync_status: "error",
        google_sync_error: "invalid_event_payload",
        google_sync_attempts: attempts,
      });
      return { ok: false, error: "invalid_event_payload" };
    }

    const calendarId = connection.calendar_id;

    try {
      let eventId = job.google_event_id || null;

      if (!eventId) {
        const found = await provider.findEventByMcsJobId({
          calendarId,
          mcsJobId: jobId,
        });
        if (found.length > 1) {
          await updateJobGoogleSync(jobId, {
            google_sync_status: "error",
            google_sync_error: "duplicate_remote_events",
            google_sync_attempts: attempts,
          });
          await logSyncFailed({
            leadId: job.lead_id,
            jobId,
            operation: "create",
            err: new GoogleCalendarProviderError("duplicate_remote_events"),
          });
          return { ok: false, error: "duplicate_remote_events" };
        }
        if (found.length === 1) {
          eventId = found[0].id;
          await provider.updateEvent({
            calendarId,
            eventId,
            event: payload,
          });
        } else {
          const created = await provider.createEvent({
            calendarId,
            event: payload,
          });
          eventId = created.id;
        }
      } else {
        try {
          await provider.updateEvent({
            calendarId,
            eventId,
            event: payload,
          });
        } catch (err) {
          if (
            err instanceof GoogleCalendarProviderError &&
            (err.status === 404 || err.code === "not_found")
          ) {
            await updateJobGoogleSync(jobId, {
              google_sync_status: "missing_remote",
              google_sync_error: sanitizeError(err),
              google_sync_attempts: attempts,
            });
            // Recreate
            const created = await provider.createEvent({
              calendarId,
              event: payload,
            });
            eventId = created.id;
          } else {
            throw err;
          }
        }
      }

      await updateJobGoogleSync(jobId, {
        google_event_id: eventId,
        google_sync_status: "synced",
        google_synced_at: "now",
        google_sync_attempts: 0,
      });
      return { ok: true, eventId };
    } catch (err) {
      await noteConnectionSideEffects(err, provider, calendarId);
      const ownerSafe = safeJobSyncError(err);
      const status =
        err instanceof GoogleCalendarProviderError &&
        (err.status === 404 || err.code === "not_found")
          ? "missing_remote"
          : "error";
      await updateJobGoogleSync(jobId, {
        google_sync_status: status,
        google_sync_error: ownerSafe,
        google_sync_attempts: attempts,
      });
      await logSyncFailed({
        leadId: job.lead_id,
        jobId,
        operation: eventOpLabel(job),
        err,
      });
      return { ok: false, error: ownerSafe, syncStatus: status };
    }
  } catch (err) {
    // Absolute last resort — never throw to MCS callers
    console.error("[google-calendar] syncScheduledJobToGoogle", {
      errorClass: errorClass(err),
      jobId,
      operation: "sync",
    });
    return { ok: false, error: safeJobSyncError(err) };
  }
}

function eventOpLabel(job) {
  if (job.google_event_id) return "update";
  return "create";
}

/**
 * Delete Google event for Job (unschedule path).
 */
export async function deleteGoogleEventForJob(jobId, opts = {}) {
  try {
    const connection = await getConnectedGoogleCalendar();
    if (!connection) {
      return { ok: true, skipped: "not_connected" };
    }

    const job = await getJobById(jobId);
    if (!job) return { ok: false, error: "not_found" };

    if (!job.google_event_id) {
      await updateJobGoogleSync(jobId, {
        google_event_id: null,
        google_sync_status: "none",
        google_sync_attempts: 0,
      });
      return { ok: true, skipped: "no_event_id" };
    }

    const provider = opts.provider || (await resolveGoogleCalendarProvider());
    const attempts = (job.google_sync_attempts || 0) + 1;
    await updateJobGoogleSync(jobId, { google_sync_status: "pending" });

    try {
      await provider.deleteEvent({
        calendarId: connection.calendar_id,
        eventId: job.google_event_id,
      });
      await updateJobGoogleSync(jobId, {
        google_event_id: null,
        google_sync_status: "none",
        google_sync_attempts: 0,
      });
      return { ok: true };
    } catch (err) {
      if (
        err instanceof GoogleCalendarProviderError &&
        (err.status === 404 || err.code === "not_found")
      ) {
        // Already gone — clear local id
        await updateJobGoogleSync(jobId, {
          google_event_id: null,
          google_sync_status: "none",
          google_sync_attempts: 0,
        });
        return { ok: true, cleared: "missing_remote" };
      }
      await noteConnectionSideEffects(err, provider, connection.calendar_id);
      const ownerSafe = safeJobSyncError(err);
      await updateJobGoogleSync(jobId, {
        google_sync_status: "error",
        google_sync_error: ownerSafe,
        google_sync_attempts: attempts,
      });
      await logSyncFailed({
        leadId: job.lead_id,
        jobId,
        operation: "delete",
        err,
      });
      return { ok: false, error: ownerSafe };
    }
  } catch (err) {
    console.error("[google-calendar] deleteGoogleEventForJob", {
      errorClass: errorClass(err),
      jobId,
      operation: "delete",
    });
    return { ok: false, error: safeJobSyncError(err) };
  }
}

/**
 * Ensure cancelled Job has CANCELLED-prefixed Google event.
 */
export async function syncCancelledJobToGoogle(jobId, opts = {}) {
  try {
    const job = await getJobById(jobId);
    if (!job) return { ok: false, error: "not_found" };
    if (job.status !== "cancelled") {
      return { ok: true, skipped: "not_cancelled" };
    }
    if (!job.scheduled_date && !job.google_event_id) {
      return { ok: true, skipped: "no_schedule_projection" };
    }
    // Reuse scheduled sync with cancelled title (payload builder)
    return syncScheduledJobToGoogle(jobId, opts);
  } catch (err) {
    console.error("[google-calendar] syncCancelledJobToGoogle", err);
    return { ok: false, error: sanitizeError(err) };
  }
}

/**
 * Owner retry — applies MCS truth.
 */
export async function retryGoogleCalendarSync(jobId, opts = {}) {
  try {
    const job = await getJobById(jobId);
    if (!job) return { ok: false, error: "not_found" };

    if (job.status === "cancelled") {
      return syncCancelledJobToGoogle(jobId, opts);
    }

    if (
      job.status === "authorized" ||
      !(job.scheduled_date ?? null)
    ) {
      return deleteGoogleEventForJob(jobId, opts);
    }

    if (job.status === "completed") {
      // Historical: only repair if pending/error/missing and event expected
      if (
        job.google_sync_status === "synced" &&
        job.google_event_id &&
        !opts.force
      ) {
        return { ok: true, skipped: "completed_unchanged" };
      }
      return syncScheduledJobToGoogle(jobId, opts);
    }

    // scheduled | in_progress with date
    return syncScheduledJobToGoogle(jobId, opts);
  } catch (err) {
    console.error("[google-calendar] retryGoogleCalendarSync", err);
    return { ok: false, error: sanitizeError(err) };
  }
}

/**
 * Fire-and-forget safe wrapper for post-commit hooks.
 * Never throws.
 */
export async function safeAfterScheduleSync(jobId) {
  try {
    return await syncScheduledJobToGoogle(jobId);
  } catch (err) {
    console.error("[google-calendar] safeAfterScheduleSync", err);
    return { ok: false, error: sanitizeError(err) };
  }
}

export async function safeAfterUnscheduleSync(jobId) {
  try {
    return await deleteGoogleEventForJob(jobId);
  } catch (err) {
    console.error("[google-calendar] safeAfterUnscheduleSync", err);
    return { ok: false, error: sanitizeError(err) };
  }
}

export async function safeAfterCancelSync(jobId) {
  try {
    return await syncCancelledJobToGoogle(jobId);
  } catch (err) {
    console.error("[google-calendar] safeAfterCancelSync", err);
    return { ok: false, error: sanitizeError(err) };
  }
}
