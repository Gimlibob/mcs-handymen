import { randomUUID } from "node:crypto";
import { getSql } from "./client.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Latest non-superseded analysis for a lead, or null.
 */
export async function getLatestLeadAnalysis(leadId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, created_at, created_by, provider, model, prompt_version,
      input_fingerprint, crm_next_action_snapshot, analysis, meta, superseded_by
    FROM ai_lead_analyses
    WHERE lead_id = ${leadId}
      AND superseded_by IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getLeadAnalysisById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, lead_id, created_at, created_by, provider, model, prompt_version,
      input_fingerprint, crm_next_action_snapshot, analysis, meta, superseded_by
    FROM ai_lead_analyses
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Persist a validated analysis with atomic supersession.
 *
 * Order (single transaction; never insert-active-then-supersede):
 *   1. LOCK parent leads row FOR UPDATE
 *   2. UPDATE prior active analyses SET superseded_by = newId
 *      (FK DEFERRABLE INITIALLY DEFERRED)
 *   3. INSERT new active row with id = newId
 *
 * Never writes to lead_notes / customer_notes / leads content / Playbook.
 */
export async function insertLeadAnalysis({
  leadId,
  provider,
  model,
  promptVersion,
  inputFingerprint,
  crmNextActionSnapshot = null,
  analysis,
  meta = null,
  createdBy = "owner",
}) {
  const sql = requireSql();

  if (typeof leadId !== "string" || leadId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (!analysis || typeof analysis !== "object") {
    return { ok: false, error: "invalid_analysis" };
  }

  const newId = randomUUID();

  let results;
  try {
    results = await sql.transaction((txn) => [
      txn`
        SELECT id
        FROM leads
        WHERE id = ${leadId}
        FOR UPDATE
      `,
      txn`
        UPDATE ai_lead_analyses
        SET superseded_by = ${newId}
        WHERE lead_id = ${leadId}
          AND superseded_by IS NULL
      `,
      txn`
        INSERT INTO ai_lead_analyses (
          id,
          lead_id,
          created_by,
          provider,
          model,
          prompt_version,
          input_fingerprint,
          crm_next_action_snapshot,
          analysis,
          meta
        )
        SELECT
          ${newId},
          l.id,
          ${createdBy},
          ${provider},
          ${model},
          ${promptVersion},
          ${inputFingerprint},
          ${crmNextActionSnapshot},
          ${JSON.stringify(analysis)}::jsonb,
          ${meta ? JSON.stringify(meta) : null}::jsonb
        FROM leads l
        WHERE l.id = ${leadId}
        RETURNING
          id, lead_id, created_at, created_by, provider, model, prompt_version,
          input_fingerprint, crm_next_action_snapshot, analysis, meta, superseded_by
      `,
    ]);
  } catch (error) {
    console.error("[cc/ai-lead-analyses] insert failed", error?.message || error);
    return { ok: false, error: "persist_failed" };
  }

  const lockedRows = results?.[0];
  const leadRow = Array.isArray(lockedRows) ? lockedRows[0] : lockedRows;
  if (!leadRow?.id) {
    return { ok: false, error: "lead_not_found" };
  }

  const insertedRows = results?.[2];
  const row = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
  if (!row?.id) return { ok: false, error: "insert_failed" };

  return { ok: true, analysis: row };
}

/**
 * Count rows in CRM note tables that match a marker (for regression tests).
 */
export async function countLeadNotesContaining(leadId, needle) {
  const sql = requireSql();
  const pattern = `%${needle}%`;
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM lead_notes
    WHERE lead_id = ${leadId}
      AND body ILIKE ${pattern}
  `;
  return rows[0]?.count ?? 0;
}

export async function countCustomerNotesContaining(customerId, needle) {
  const sql = requireSql();
  if (!customerId) return 0;
  const pattern = `%${needle}%`;
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM customer_notes
    WHERE customer_id = ${customerId}
      AND body ILIKE ${pattern}
  `;
  return rows[0]?.count ?? 0;
}
