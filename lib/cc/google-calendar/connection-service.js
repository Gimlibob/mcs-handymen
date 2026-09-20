/**
 * Connection lifecycle + initial sync (GC-2).
 */

import { chicagoToday } from "../domain/chicago-date.js";
import { getSql } from "../db/client.js";
import {
  getConnectedGoogleCalendar,
  getLatestGoogleCalendarConnection,
  setConnectionStatus,
  updateConnectionCalendarId,
  upsertGoogleCalendarConnection,
} from "../db/google-calendar-connections.js";
import {
  getMcsJobsCalendarSummary,
  GOOGLE_OAUTH_SCOPES,
  isGoogleCalendarSyncEnabled,
} from "./config.js";
import { createLiveGoogleCalendarProvider } from "./live-provider.js";
import { GoogleCalendarProviderError } from "./provider.js";
import { safeOwnerError } from "./safe-errors.js";
import { encryptRefreshToken } from "./token-crypto.js";
import { syncScheduledJobToGoogle } from "./sync-engine.js";
import { BUSINESS_TIMEZONE } from "../domain/chicago-date.js";

function requireSql() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  return sql;
}

/**
 * After OAuth tokens + identity validated: persist token, ensure calendar.
 */
export async function finalizeOAuthConnection({
  email,
  sub,
  refreshToken,
  providerFactory = null,
}) {
  if (!isGoogleCalendarSyncEnabled()) {
    return { ok: false, error: "sync_disabled" };
  }

  const ciphertext = encryptRefreshToken(refreshToken);
  const scopes = GOOGLE_OAUTH_SCOPES.join(" ");

  const latest = await getLatestGoogleCalendarConnection();
  const existingCalId = latest?.calendar_id || null;

  await upsertGoogleCalendarConnection({
    googleAccountEmail: email,
    googleAccountSub: sub,
    calendarId: existingCalId,
    refreshTokenCiphertext: ciphertext,
    scopes,
    status: "error",
    lastError: existingCalId ? null : "calendar_pending",
  });

  const provider =
    typeof providerFactory === "function"
      ? providerFactory(ciphertext)
      : createLiveGoogleCalendarProvider({
          refreshTokenCiphertext: ciphertext,
        });

  try {
    let calendarId = existingCalId;
    if (calendarId) {
      try {
        await provider.getCalendar({ calendarId });
      } catch (err) {
        if (
          err instanceof GoogleCalendarProviderError &&
          err.status === 404
        ) {
          const conn = await getLatestGoogleCalendarConnection();
          await setConnectionStatus(
            conn.id,
            "error",
            "MCS Jobs calendar not found"
          );
          return {
            ok: false,
            error: "calendar_missing",
            needsRepair: true,
          };
        }
        throw err;
      }
    } else {
      const created = await provider.createCalendar({
        summary: getMcsJobsCalendarSummary(),
        timeZone: BUSINESS_TIMEZONE,
      });
      calendarId = created.id;
    }

    const conn = await getLatestGoogleCalendarConnection();
    await updateConnectionCalendarId(conn.id, calendarId);
    return { ok: true, calendarId };
  } catch (err) {
    const conn = await getLatestGoogleCalendarConnection();
    if (conn) {
      await setConnectionStatus(
        conn.id,
        "error",
        safeOwnerError(err)
      );
    }
    return { ok: false, error: safeOwnerError(err) };
  }
}

export { safeOwnerError };

export async function disconnectGoogleCalendar({ revokeFn = null } = {}) {
  const conn = await getLatestGoogleCalendarConnection();
  if (!conn) return { ok: true, skipped: "none" };

  if (conn.refresh_token_ciphertext && typeof revokeFn === "function") {
    try {
      await revokeFn(conn.refresh_token_ciphertext);
    } catch {
      // best-effort
    }
  }

  await upsertGoogleCalendarConnection({
    googleAccountEmail: conn.google_account_email,
    googleAccountSub: conn.google_account_sub,
    calendarId: conn.calendar_id,
    refreshTokenCiphertext: null,
    clearToken: true,
    scopes: conn.scopes,
    status: "disconnected",
    lastError: null,
  });

  // clearToken path — ensure token null via direct update
  const sql = requireSql();
  await sql`
    UPDATE google_calendar_connections
    SET
      refresh_token_ciphertext = NULL,
      status = 'disconnected',
      last_error = NULL,
      updated_at = now()
    WHERE id = ${conn.id}
  `;

  return { ok: true };
}

export async function repairGoogleCalendar({
  providerFactory = null,
} = {}) {
  const conn = await getLatestGoogleCalendarConnection();
  if (!conn?.refresh_token_ciphertext) {
    return { ok: false, error: "not_authorized" };
  }

  const provider =
    typeof providerFactory === "function"
      ? providerFactory(conn.refresh_token_ciphertext)
      : createLiveGoogleCalendarProvider({
          refreshTokenCiphertext: conn.refresh_token_ciphertext,
        });

  try {
    const created = await provider.createCalendar({
      summary: getMcsJobsCalendarSummary(),
      timeZone: BUSINESS_TIMEZONE,
    });
    await updateConnectionCalendarId(conn.id, created.id);
    return { ok: true, calendarId: created.id };
  } catch (err) {
    await setConnectionStatus(conn.id, "error", safeOwnerError(err));
    return { ok: false, error: safeOwnerError(err) };
  }
}

/**
 * Count future scheduled Jobs eligible for initial sync.
 */
export async function countFutureScheduledJobsForInitialSync() {
  const sql = requireSql();
  const today = chicagoToday();
  const [row] = await sql`
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE status = 'scheduled'
      AND scheduled_date IS NOT NULL
      AND scheduled_date >= ${today}::date
  `;
  return row?.c ?? 0;
}

/**
 * List future scheduled Job ids for initial sync.
 */
export async function listFutureScheduledJobIdsForInitialSync() {
  const sql = requireSql();
  const today = chicagoToday();
  const rows = await sql`
    SELECT id
    FROM jobs
    WHERE status = 'scheduled'
      AND scheduled_date IS NOT NULL
      AND scheduled_date >= ${today}::date
    ORDER BY scheduled_date ASC, authorized_at ASC
  `;
  return rows.map((r) => r.id);
}

/**
 * Explicit bulk sync — continues on per-job failure.
 */
export async function syncFutureScheduledJobs({ provider } = {}) {
  const connected = await getConnectedGoogleCalendar();
  if (!connected) {
    return { ok: false, error: "not_connected" };
  }

  const ids = await listFutureScheduledJobIdsForInitialSync();
  let synced = 0;
  let alreadySynced = 0;
  let failed = 0;

  for (const jobId of ids) {
    const before = await import("../db/jobs.js").then((m) =>
      m.getJobById(jobId)
    );
    const wasSynced =
      before?.google_sync_status === "synced" && before?.google_event_id;

    const result = await syncScheduledJobToGoogle(jobId, { provider });
    if (result.ok) {
      if (wasSynced && result.eventId === before.google_event_id) {
        alreadySynced += 1;
      } else {
        synced += 1;
      }
    } else if (result.skipped) {
      alreadySynced += 1;
    } else {
      failed += 1;
    }
  }

  return {
    ok: true,
    total: ids.length,
    synced,
    alreadySynced,
    failed,
  };
}

export { getConnectedGoogleCalendar, getLatestGoogleCalendarConnection };
