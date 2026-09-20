import { randomUUID } from "node:crypto";
import { getSql } from "./client.js";
import { getCustomerById } from "./customers.js";
import { getLeadById, logLeadActivity } from "./leads.js";
import {
  canTransitionJobStatus,
  isLeadEligibleForJobCreate,
  isValidJobStatus,
  jobStatusLabel,
} from "../domain/job-status.js";
import {
  canRescheduleJob,
  canScheduleJob,
  canSetScheduleDate,
  canUnscheduleJob,
  isScheduleManagedTransition,
  normalizeScheduleWindow,
} from "../domain/job-scheduling.js";
import {
  normalizeCalendarDateInput,
  toCalendarDateString,
} from "../domain/chicago-date.js";
import { assertWorkerAssignable, getWorkerById } from "./workers.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/** Post-commit Google sync — never throws, never rolls back MCS. */
async function runGoogleSyncHook(kind, jobId) {
  try {
    const mod = await import("../google-calendar/sync-engine.js");
    if (kind === "schedule" || kind === "reschedule") {
      return await mod.safeAfterScheduleSync(jobId);
    }
    if (kind === "unschedule") {
      return await mod.safeAfterUnscheduleSync(jobId);
    }
    if (kind === "cancel") {
      return await mod.safeAfterCancelSync(jobId);
    }
  } catch (err) {
    console.error(`[cc/jobs] google sync hook (${kind})`, err);
  }
  return { ok: false, error: "hook_failed" };
}

/** Normalize DATE fields from Neon for consistent YYYY-MM-DD strings. */
function normalizeJobRow(row) {
  if (!row) return row;
  return {
    ...row,
    scheduled_date: toCalendarDateString(row.scheduled_date),
  };
}

/**
 * Active (non-cancelled) Job for a Lead, or null.
 */
export async function getActiveJobForLead(leadId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
    FROM jobs
    WHERE lead_id = ${leadId}
      AND status <> 'cancelled'
    ORDER BY authorized_at DESC
    LIMIT 1
  `;
  return rows[0] ? normalizeJobRow(rows[0]) : null;
}

export async function getJobById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
    FROM jobs
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? normalizeJobRow(rows[0]) : null;
}

/**
 * All Jobs for a Customer with assigned worker display name (Phase 5A).
 * Single query — caller partitions into upcoming/history in domain layer.
 * Ordering is stable for display; Phase 5B may enhance via scheduled_date in domain sorts.
 *
 * @param {string} customerId
 * @returns {Promise<object[]>}
 */
export async function listJobsForCustomer(customerId) {
  const sql = requireSql();
  if (typeof customerId !== "string" || !customerId) return [];

  const rows = await sql`
    SELECT
      j.id,
      j.lead_id,
      j.customer_id,
      j.assigned_worker_id,
      j.status,
      j.service_type,
      j.scope_summary,
      j.property_type,
      j.service_city,
      j.authorized_at,
      j.created_at,
      j.updated_at,
      j.completed_at,
      j.cancelled_at,
      j.scheduled_date,
      j.scheduled_window,
      j.google_event_id,
      j.google_sync_status,
      j.google_synced_at,
      j.google_sync_error,
      j.google_sync_attempts,
      w.display_name AS assigned_worker_name
    FROM jobs j
    LEFT JOIN workers w ON w.id = j.assigned_worker_id
    WHERE j.customer_id = ${customerId}
    ORDER BY j.authorized_at DESC, j.id DESC
  `;
  return rows.map(normalizeJobRow);
}

/**
 * Explicit owner create: Lead → Job with snapshotted operational facts.
 * Idempotent: returns existing active Job when one already exists.
 * Never changes Lead status. Never called by AI.
 *
 * @returns {{ ok: true, job: object, created: boolean } | { ok: false, error: string }}
 */
export async function createJobFromLead({ leadId, createdBy = "owner" }) {
  const sql = requireSql();

  if (typeof leadId !== "string" || leadId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  const lead = await getLeadById(leadId);
  if (!lead) return { ok: false, error: "lead_not_found" };

  if (!isLeadEligibleForJobCreate(lead.status)) {
    return { ok: false, error: "lead_not_eligible", status: lead.status };
  }

  if (!lead.customer_id) {
    return { ok: false, error: "missing_customer" };
  }

  const customer = await getCustomerById(lead.customer_id);
  if (!customer || customer.merged_into_customer_id) {
    return { ok: false, error: "invalid_customer" };
  }

  const existing = await getActiveJobForLead(leadId);
  if (existing) {
    return { ok: true, job: existing, created: false };
  }

  const serviceType =
    typeof lead.project_type === "string" ? lead.project_type.trim() : "";
  const scopeSummary =
    typeof lead.description === "string" ? lead.description.trim() : "";
  const propertyType =
    typeof lead.property_type === "string" ? lead.property_type.trim() : "";
  const serviceCity = typeof lead.city === "string" ? lead.city.trim() : "";

  if (!serviceType || !scopeSummary || !propertyType || !serviceCity) {
    return { ok: false, error: "incomplete_snapshots" };
  }

  const newId = randomUUID();

  let results;
  try {
    results = await sql.transaction((txn) => [
      txn`
        SELECT id, customer_id, status, project_type, description, property_type, city
        FROM leads
        WHERE id = ${leadId}
        FOR UPDATE
      `,
      txn`
        SELECT
          id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
          property_type, service_city, authorized_at, created_at, updated_at,
          completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
        FROM jobs
        WHERE lead_id = ${leadId}
          AND status <> 'cancelled'
        LIMIT 1
      `,
      txn`
        INSERT INTO jobs (
          id,
          lead_id,
          customer_id,
          status,
          service_type,
          scope_summary,
          property_type,
          service_city
        )
        SELECT
          ${newId},
          l.id,
          l.customer_id,
          'authorized',
          trim(l.project_type),
          trim(l.description),
          trim(l.property_type),
          trim(l.city)
        FROM leads l
        WHERE l.id = ${leadId}
          AND l.customer_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.lead_id = l.id
              AND j.status <> 'cancelled'
          )
        RETURNING
          id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
          property_type, service_city, authorized_at, created_at, updated_at,
          completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
      `,
    ]);
  } catch (error) {
    // Unique index race: another request inserted the active Job first.
    const existingAfterRace = await getActiveJobForLead(leadId);
    if (existingAfterRace) {
      return { ok: true, job: existingAfterRace, created: false };
    }
    console.error("[cc/jobs] create failed", error?.message || error);
    return { ok: false, error: "create_failed" };
  }

  const lockedRows = results?.[0];
  const lockedLead = Array.isArray(lockedRows) ? lockedRows[0] : lockedRows;
  if (!lockedLead?.id) {
    return { ok: false, error: "lead_not_found" };
  }

  if (!isLeadEligibleForJobCreate(lockedLead.status)) {
    return { ok: false, error: "lead_not_eligible", status: lockedLead.status };
  }

  if (!lockedLead.customer_id) {
    return { ok: false, error: "missing_customer" };
  }

  const existingRows = results?.[1];
  const concurrent = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  if (concurrent?.id) {
    return { ok: true, job: concurrent, created: false };
  }

  const insertedRows = results?.[2];
  const inserted = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
  if (!inserted?.id) {
    // Lost race or incomplete snapshots — prefer returning existing.
    const again = await getActiveJobForLead(leadId);
    if (again) return { ok: true, job: again, created: false };
    return { ok: false, error: "create_failed" };
  }

  await logLeadActivity({
    leadId,
    eventType: "job_created",
    message: "Job created from lead",
    meta: { jobId: inserted.id },
    createdBy,
  });

  return { ok: true, job: inserted, created: true };
}

/**
 * Update Job status with deterministic transitions.
 * Does not modify Lead status. Does not modify worker assignment.
 */
export async function updateJobStatus({ jobId, nextStatus, actor = "owner" }) {
  const sql = requireSql();

  if (typeof jobId !== "string" || jobId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (!isValidJobStatus(nextStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const job = await getJobById(jobId);
  if (!job) return { ok: false, error: "not_found" };

  if (!canTransitionJobStatus(job.status, nextStatus)) {
    return {
      ok: false,
      error: "invalid_transition",
      from: job.status,
      to: nextStatus,
    };
  }

  if (isScheduleManagedTransition(job.status, nextStatus)) {
    return {
      ok: false,
      error: "use_schedule_action",
      from: job.status,
      to: nextStatus,
    };
  }

  const leadBefore = await getLeadById(job.lead_id);
  const leadStatusBefore = leadBefore?.status ?? null;
  const assignedBefore = job.assigned_worker_id ?? null;

  let rows;
  if (nextStatus === "completed") {
    rows = await sql`
      UPDATE jobs
      SET
        status = ${nextStatus},
        completed_at = now(),
        cancelled_at = NULL,
        updated_at = now()
      WHERE id = ${jobId}
      RETURNING
        id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
    `;
  } else if (nextStatus === "cancelled") {
    rows = await sql`
      UPDATE jobs
      SET
        status = ${nextStatus},
        cancelled_at = now(),
        updated_at = now()
      WHERE id = ${jobId}
      RETURNING
        id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
    `;
  } else {
    rows = await sql`
      UPDATE jobs
      SET
        status = ${nextStatus},
        updated_at = now()
      WHERE id = ${jobId}
      RETURNING
        id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
    `;
  }

  const updated = rows[0] ? normalizeJobRow(rows[0]) : null;
  if (!updated) return { ok: false, error: "update_failed" };

  if ((updated.assigned_worker_id ?? null) !== assignedBefore) {
    console.error("[cc/jobs] unexpected assignment change after Job status update");
    return { ok: false, error: "assignment_guard_failed" };
  }

  // Schedule fields must be retained across status transitions.
  if (
    toCalendarDateString(job.scheduled_date) !==
      toCalendarDateString(updated.scheduled_date) ||
    (job.scheduled_window ?? null) !== (updated.scheduled_window ?? null)
  ) {
    console.error("[cc/jobs] unexpected schedule change after Job status update");
    return { ok: false, error: "schedule_guard_failed" };
  }

  const leadAfter = await getLeadById(job.lead_id);
  if (leadAfter && leadStatusBefore && leadAfter.status !== leadStatusBefore) {
    console.error("[cc/jobs] unexpected Lead status change after Job update");
    return { ok: false, error: "lead_guard_failed" };
  }

  await logLeadActivity({
    leadId: job.lead_id,
    eventType: "job_status_changed",
    message: `Job status changed from ${jobStatusLabel(job.status)} to ${jobStatusLabel(nextStatus)}`,
    meta: { jobId, from: job.status, to: nextStatus },
    createdBy: actor,
  });

  if (nextStatus === "cancelled") {
    await runGoogleSyncHook("cancel", jobId);
  }

  return { ok: true, job: updated };
}

/**
 * Assign, reassign, or unassign the primary worker on a Job.
 * Does not modify Job status or Lead status.
 *
 * @param {{ jobId: string, workerId: string | null, actor?: string }} args
 *   workerId null = unassign
 */
export async function setJobAssignedWorker({
  jobId,
  workerId,
  actor = "owner",
}) {
  const sql = requireSql();

  if (typeof jobId !== "string" || jobId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  const nextWorkerId =
    workerId === null || workerId === undefined || workerId === ""
      ? null
      : typeof workerId === "string"
        ? workerId.trim()
        : null;

  if (workerId !== null && workerId !== undefined && workerId !== "" && !nextWorkerId) {
    return { ok: false, error: "invalid_input" };
  }

  const job = await getJobById(jobId);
  if (!job) return { ok: false, error: "not_found" };

  const fromWorkerId = job.assigned_worker_id ?? null;

  if (fromWorkerId === nextWorkerId) {
    return { ok: true, job, unchanged: true };
  }

  let toWorker = null;
  if (nextWorkerId) {
    toWorker = await getWorkerById(nextWorkerId);
    const gate = assertWorkerAssignable(toWorker);
    if (!gate.ok) return gate;
  }

  const fromWorker = fromWorkerId ? await getWorkerById(fromWorkerId) : null;
  const fromDisplayName = fromWorker?.display_name ?? null;
  const toDisplayName = toWorker?.display_name ?? null;

  const leadBefore = await getLeadById(job.lead_id);
  const leadStatusBefore = leadBefore?.status ?? null;
  const jobStatusBefore = job.status;

  const rows = await sql`
    UPDATE jobs
    SET
      assigned_worker_id = ${nextWorkerId},
      updated_at = now()
    WHERE id = ${jobId}
    RETURNING
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
  `;

  const updated = rows[0];
  if (!updated) return { ok: false, error: "update_failed" };

  if (updated.status !== jobStatusBefore) {
    console.error("[cc/jobs] unexpected Job status change after assignment");
    return { ok: false, error: "job_status_guard_failed" };
  }

  const leadAfter = await getLeadById(job.lead_id);
  if (leadAfter && leadStatusBefore && leadAfter.status !== leadStatusBefore) {
    console.error("[cc/jobs] unexpected Lead status change after assignment");
    return { ok: false, error: "lead_guard_failed" };
  }

  let message;
  if (!fromWorkerId && nextWorkerId) {
    message = `Worker assigned: ${toDisplayName}`;
  } else if (fromWorkerId && nextWorkerId) {
    message = `Worker reassigned from ${fromDisplayName} to ${toDisplayName}`;
  } else {
    message = `Worker unassigned: ${fromDisplayName}`;
  }

  await logLeadActivity({
    leadId: job.lead_id,
    eventType: "job_assignment_changed",
    message,
    meta: {
      jobId,
      fromWorkerId,
      toWorkerId: nextWorkerId,
      fromDisplayName,
      toDisplayName,
    },
    createdBy: actor,
  });

  return { ok: true, job: normalizeJobRow(updated) };
}

/**
 * Needs Scheduling queue: authorized null-date + legacy scheduled null-date.
 * Ordered oldest authorized_at first.
 */
export async function listNeedsSchedulingJobs({ limit = 50 } = {}) {
  const sql = requireSql();
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await sql`
    SELECT
      j.id,
      j.lead_id,
      j.customer_id,
      j.assigned_worker_id,
      j.status,
      j.service_type,
      j.scope_summary,
      j.property_type,
      j.service_city,
      j.authorized_at,
      j.created_at,
      j.updated_at,
      j.completed_at,
      j.cancelled_at,
      j.scheduled_date,
      j.scheduled_window,
      j.google_event_id,
      j.google_sync_status,
      j.google_synced_at,
      j.google_sync_error,
      j.google_sync_attempts,
      c.full_name AS customer_name,
      w.display_name AS assigned_worker_name
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    LEFT JOIN workers w ON w.id = j.assigned_worker_id
    WHERE j.scheduled_date IS NULL
      AND j.status IN ('authorized', 'scheduled')
    ORDER BY j.authorized_at ASC, j.id ASC
    LIMIT ${cap}
  `;
  return rows.map(normalizeJobRow);
}

/**
 * Dashboard scheduling KPIs (civil dates in America/Chicago passed by caller).
 * @param {{ today: string, tomorrow: string }} args
 */
export async function getSchedulingDashboardCounts({ today, tomorrow }) {
  const sql = requireSql();
  const todayYmd = normalizeCalendarDateInput(today);
  const tomorrowYmd = normalizeCalendarDateInput(tomorrow);
  if (!todayYmd || !tomorrowYmd) {
    return { needsScheduling: 0, jobsToday: 0, jobsTomorrow: 0 };
  }

  const [row] = await sql`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM jobs
        WHERE scheduled_date IS NULL
          AND status IN ('authorized', 'scheduled')
      ) AS needs_scheduling,
      (
        SELECT COUNT(*)::int
        FROM jobs
        WHERE scheduled_date = ${todayYmd}::date
          AND status <> 'cancelled'
      ) AS jobs_today,
      (
        SELECT COUNT(*)::int
        FROM jobs
        WHERE scheduled_date = ${tomorrowYmd}::date
          AND status <> 'cancelled'
      ) AS jobs_tomorrow
  `;

  return {
    needsScheduling: row?.needs_scheduling ?? 0,
    jobsToday: row?.jobs_today ?? 0,
    jobsTomorrow: row?.jobs_tomorrow ?? 0,
  };
}

/**
 * Calendar week query — one efficient range join.
 * @param {{ weekStart: string, weekEnd: string, workerId?: string | null | 'unassigned', status?: string | null }} args
 */
export async function listJobsForCalendarRange({
  weekStart,
  weekEnd,
  workerId = null,
  status = null,
}) {
  const sql = requireSql();
  const start = normalizeCalendarDateInput(weekStart);
  const end = normalizeCalendarDateInput(weekEnd);
  if (!start || !end) return [];

  const statusFilter =
    typeof status === "string" && isValidJobStatus(status) ? status : null;

  let rows;
  if (workerId === "unassigned") {
    if (statusFilter) {
      rows = await sql`
        SELECT
          j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
          j.service_type, j.scope_summary, j.property_type, j.service_city,
          j.authorized_at, j.created_at, j.updated_at,
          j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
          c.full_name AS customer_name,
          w.display_name AS assigned_worker_name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN workers w ON w.id = j.assigned_worker_id
        WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
          AND j.assigned_worker_id IS NULL
          AND j.status = ${statusFilter}
        ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
      `;
    } else {
      rows = await sql`
        SELECT
          j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
          j.service_type, j.scope_summary, j.property_type, j.service_city,
          j.authorized_at, j.created_at, j.updated_at,
          j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
          c.full_name AS customer_name,
          w.display_name AS assigned_worker_name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN workers w ON w.id = j.assigned_worker_id
        WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
          AND j.assigned_worker_id IS NULL
        ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
      `;
    }
  } else if (typeof workerId === "string" && workerId) {
    if (statusFilter) {
      rows = await sql`
        SELECT
          j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
          j.service_type, j.scope_summary, j.property_type, j.service_city,
          j.authorized_at, j.created_at, j.updated_at,
          j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
          c.full_name AS customer_name,
          w.display_name AS assigned_worker_name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN workers w ON w.id = j.assigned_worker_id
        WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
          AND j.assigned_worker_id = ${workerId}
          AND j.status = ${statusFilter}
        ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
      `;
    } else {
      rows = await sql`
        SELECT
          j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
          j.service_type, j.scope_summary, j.property_type, j.service_city,
          j.authorized_at, j.created_at, j.updated_at,
          j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
          c.full_name AS customer_name,
          w.display_name AS assigned_worker_name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN workers w ON w.id = j.assigned_worker_id
        WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
          AND j.assigned_worker_id = ${workerId}
        ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
      `;
    }
  } else if (statusFilter) {
    rows = await sql`
      SELECT
        j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
        j.service_type, j.scope_summary, j.property_type, j.service_city,
        j.authorized_at, j.created_at, j.updated_at,
        j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
        c.full_name AS customer_name,
        w.display_name AS assigned_worker_name
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN workers w ON w.id = j.assigned_worker_id
      WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
        AND j.status = ${statusFilter}
      ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
    `;
  } else {
    rows = await sql`
      SELECT
        j.id, j.lead_id, j.customer_id, j.assigned_worker_id, j.status,
        j.service_type, j.scope_summary, j.property_type, j.service_city,
        j.authorized_at, j.created_at, j.updated_at,
        j.completed_at, j.cancelled_at, j.scheduled_date, j.scheduled_window, j.google_event_id, j.google_sync_status, j.google_synced_at, j.google_sync_error, j.google_sync_attempts,
        c.full_name AS customer_name,
        w.display_name AS assigned_worker_name
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN workers w ON w.id = j.assigned_worker_id
      WHERE j.scheduled_date BETWEEN ${start}::date AND ${end}::date
      ORDER BY j.scheduled_date ASC, j.scheduled_window ASC NULLS LAST, j.authorized_at ASC
    `;
  }

  return rows.map(normalizeJobRow);
}

/**
 * Schedule authorized Job, or set first date on legacy scheduled+null.
 */
export async function scheduleJob({
  jobId,
  scheduledDate,
  scheduledWindow,
  actor = "owner",
}) {
  const sql = requireSql();
  if (typeof jobId !== "string" || !jobId) {
    return { ok: false, error: "invalid_input" };
  }

  const date = normalizeCalendarDateInput(scheduledDate);
  if (!date) return { ok: false, error: "invalid_date" };

  const window = normalizeScheduleWindow(scheduledWindow, { defaultFlex: true });
  if (!window) return { ok: false, error: "invalid_window" };

  const job = await getJobById(jobId);
  if (!job) return { ok: false, error: "not_found" };

  const isInitialAuthorized = canScheduleJob(job);
  const isLegacySetDate = canSetScheduleDate(job);
  if (!isInitialAuthorized && !isLegacySetDate) {
    if (
      job.status === "in_progress" ||
      job.status === "completed" ||
      job.status === "cancelled"
    ) {
      return { ok: false, error: "schedule_read_only" };
    }
    return { ok: false, error: "not_schedulable" };
  }

  const assignedBefore = job.assigned_worker_id ?? null;
  const nextStatus = isInitialAuthorized ? "scheduled" : job.status;

  const rows = await sql`
    UPDATE jobs
    SET
      status = ${nextStatus},
      scheduled_date = ${date}::date,
      scheduled_window = ${window},
      updated_at = now()
    WHERE id = ${jobId}
    RETURNING
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
  `;

  const next = rows[0] ? normalizeJobRow(rows[0]) : null;
  if (!next) return { ok: false, error: "update_failed" };

  if ((next.assigned_worker_id ?? null) !== assignedBefore) {
    return { ok: false, error: "assignment_guard_failed" };
  }

  await logLeadActivity({
    leadId: job.lead_id,
    eventType: "job_scheduled",
    message: `Job scheduled for ${date} (${window})`,
    meta: {
      jobId,
      toDate: date,
      toWindow: window,
      fromStatus: job.status,
      toStatus: next.status,
    },
    createdBy: actor,
  });

  await runGoogleSyncHook("schedule", jobId);
  const refreshed = (await getJobById(jobId)) || next;
  return { ok: true, job: refreshed };
}

/**
 * Reschedule: scheduled + date only. Rejects in_progress/completed/cancelled.
 */
export async function rescheduleJob({
  jobId,
  scheduledDate,
  scheduledWindow,
  actor = "owner",
}) {
  const sql = requireSql();
  if (typeof jobId !== "string" || !jobId) {
    return { ok: false, error: "invalid_input" };
  }

  const date = normalizeCalendarDateInput(scheduledDate);
  if (!date) return { ok: false, error: "invalid_date" };

  const window = normalizeScheduleWindow(scheduledWindow, { defaultFlex: true });
  if (!window) return { ok: false, error: "invalid_window" };

  const job = await getJobById(jobId);
  if (!job) return { ok: false, error: "not_found" };

  if (
    job.status === "in_progress" ||
    job.status === "completed" ||
    job.status === "cancelled"
  ) {
    return { ok: false, error: "schedule_read_only" };
  }

  if (!canRescheduleJob(job)) {
    return { ok: false, error: "not_reschedulable" };
  }

  const fromDate = job.scheduled_date;
  const fromWindow = job.scheduled_window;
  const assignedBefore = job.assigned_worker_id ?? null;

  const rows = await sql`
    UPDATE jobs
    SET
      scheduled_date = ${date}::date,
      scheduled_window = ${window},
      updated_at = now()
    WHERE id = ${jobId}
      AND status = 'scheduled'
      AND scheduled_date IS NOT NULL
    RETURNING
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
  `;

  const next = rows[0] ? normalizeJobRow(rows[0]) : null;
  if (!next) return { ok: false, error: "update_failed" };

  if (next.status !== "scheduled") {
    return { ok: false, error: "status_guard_failed" };
  }
  if ((next.assigned_worker_id ?? null) !== assignedBefore) {
    return { ok: false, error: "assignment_guard_failed" };
  }

  await logLeadActivity({
    leadId: job.lead_id,
    eventType: "job_rescheduled",
    message: `Job rescheduled from ${fromDate} (${fromWindow}) to ${date} (${window})`,
    meta: {
      jobId,
      fromDate,
      toDate: date,
      fromWindow,
      toWindow: window,
    },
    createdBy: actor,
  });

  await runGoogleSyncHook("reschedule", jobId);
  const refreshed = (await getJobById(jobId)) || next;
  return { ok: true, job: refreshed };
}

/**
 * Unschedule: scheduled + date → authorized, clear schedule fields.
 */
export async function unscheduleJob({ jobId, actor = "owner" }) {
  const sql = requireSql();
  if (typeof jobId !== "string" || !jobId) {
    return { ok: false, error: "invalid_input" };
  }

  const job = await getJobById(jobId);
  if (!job) return { ok: false, error: "not_found" };

  if (!canUnscheduleJob(job)) {
    if (
      job.status === "in_progress" ||
      job.status === "completed" ||
      job.status === "cancelled"
    ) {
      return { ok: false, error: "schedule_read_only" };
    }
    return { ok: false, error: "not_unschedulable" };
  }

  const fromDate = job.scheduled_date;
  const fromWindow = job.scheduled_window;
  const assignedBefore = job.assigned_worker_id ?? null;

  const rows = await sql`
    UPDATE jobs
    SET
      status = 'authorized',
      scheduled_date = NULL,
      scheduled_window = NULL,
      updated_at = now()
    WHERE id = ${jobId}
      AND status = 'scheduled'
      AND scheduled_date IS NOT NULL
    RETURNING
      id, lead_id, customer_id, assigned_worker_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at, scheduled_date, scheduled_window, google_event_id, google_sync_status, google_synced_at, google_sync_error, google_sync_attempts
  `;

  const next = rows[0] ? normalizeJobRow(rows[0]) : null;
  if (!next) return { ok: false, error: "update_failed" };

  if ((next.assigned_worker_id ?? null) !== assignedBefore) {
    return { ok: false, error: "assignment_guard_failed" };
  }

  await logLeadActivity({
    leadId: job.lead_id,
    eventType: "job_unscheduled",
    message: `Job unscheduled (was ${fromDate} ${fromWindow})`,
    meta: {
      jobId,
      fromDate,
      fromWindow,
      toDate: null,
      toWindow: null,
    },
    createdBy: actor,
  });

  await runGoogleSyncHook("unschedule", jobId);
  const refreshed = (await getJobById(jobId)) || next;
  return { ok: true, job: refreshed };
}
