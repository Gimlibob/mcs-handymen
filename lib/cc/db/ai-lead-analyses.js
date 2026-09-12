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
 * Persist a validated analysis. Marks prior active rows for this lead as superseded.
 * Never writes to lead_notes / customer_notes / leads.
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

  if (!analysis || typeof analysis !== "object") {
    return { ok: false, error: "invalid_analysis" };
  }

  const rows = await sql`
    INSERT INTO ai_lead_analyses (
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
    VALUES (
      ${leadId},
      ${createdBy},
      ${provider},
      ${model},
      ${promptVersion},
      ${inputFingerprint},
      ${crmNextActionSnapshot},
      ${JSON.stringify(analysis)}::jsonb,
      ${meta ? JSON.stringify(meta) : null}::jsonb
    )
    RETURNING
      id, lead_id, created_at, created_by, provider, model, prompt_version,
      input_fingerprint, crm_next_action_snapshot, analysis, meta, superseded_by
  `;

  const row = rows[0];
  if (!row) return { ok: false, error: "insert_failed" };

  await sql`
    UPDATE ai_lead_analyses
    SET superseded_by = ${row.id}
    WHERE lead_id = ${leadId}
      AND id <> ${row.id}
      AND superseded_by IS NULL
  `;

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
