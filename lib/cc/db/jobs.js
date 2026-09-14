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

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Active (non-cancelled) Job for a Lead, or null.
 */
export async function getActiveJobForLead(leadId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, customer_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at
    FROM jobs
    WHERE lead_id = ${leadId}
      AND status <> 'cancelled'
    ORDER BY authorized_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getJobById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, customer_id, status, service_type, scope_summary,
      property_type, service_city, authorized_at, created_at, updated_at,
      completed_at, cancelled_at
    FROM jobs
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
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
          id, lead_id, customer_id, status, service_type, scope_summary,
          property_type, service_city, authorized_at, created_at, updated_at,
          completed_at, cancelled_at
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
          id, lead_id, customer_id, status, service_type, scope_summary,
          property_type, service_city, authorized_at, created_at, updated_at,
          completed_at, cancelled_at
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
 * Does not modify Lead status.
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

  const leadBefore = await getLeadById(job.lead_id);
  const leadStatusBefore = leadBefore?.status ?? null;

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
        id, lead_id, customer_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at
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
        id, lead_id, customer_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at
    `;
  } else {
    rows = await sql`
      UPDATE jobs
      SET
        status = ${nextStatus},
        updated_at = now()
      WHERE id = ${jobId}
      RETURNING
        id, lead_id, customer_id, status, service_type, scope_summary,
        property_type, service_city, authorized_at, created_at, updated_at,
        completed_at, cancelled_at
    `;
  }

  const updated = rows[0];
  if (!updated) return { ok: false, error: "update_failed" };

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

  return { ok: true, job: updated };
}
