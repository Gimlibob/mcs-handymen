import { randomUUID } from "node:crypto";
import { getSql } from "./client.js";
import { validateLeadAnalysisFeedback } from "../domain/ai-lead-feedback.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Latest active (non-superseded) feedback for an analysis, or null.
 */
export async function getActiveLeadFeedbackForAnalysis(analysisId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, analysis_id, lead_id, created_at, created_by, decision,
      corrected_suggested_next_action, correction_note, superseded_by
    FROM ai_lead_feedback
    WHERE analysis_id = ${analysisId}
      AND superseded_by IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Atomically record owner feedback on an analysis.
 *
 * Order (single transaction; never insert-active-then-supersede):
 *   1. LOCK parent ai_lead_analyses row FOR UPDATE (must match leadId)
 *   2. UPDATE prior active feedback SET superseded_by = newId
 *      (FK DEFERRABLE INITIALLY DEFERRED allows pointing at newId before INSERT)
 *   3. INSERT new active row via INSERT…SELECT from the locked analysis
 *
 * If any step fails, the transaction rolls back — prior active decision remains.
 * Concurrent writers serialize on the analysis row lock.
 *
 * Never writes CRM / Playbook / ai_lead_analyses content.
 */
export async function submitLeadAnalysisFeedback({
  leadId,
  analysisId,
  decision,
  correctedSuggestedNextAction = null,
  correctionNote = null,
  createdBy = "owner",
}) {
  const sql = requireSql();

  if (typeof leadId !== "string" || leadId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof analysisId !== "string" || analysisId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  const validated = validateLeadAnalysisFeedback({
    decision,
    correctedSuggestedNextAction,
    correctionNote,
  });
  if (!validated.ok) return validated;

  const probe = await sql`
    SELECT id, lead_id
    FROM ai_lead_analyses
    WHERE id = ${analysisId}
    LIMIT 1
  `;
  if (!probe[0]) return { ok: false, error: "analysis_not_found" };
  if (String(probe[0].lead_id) !== String(leadId)) {
    return { ok: false, error: "analysis_lead_mismatch" };
  }

  const newId = randomUUID();

  let results;
  try {
    results = await sql.transaction((txn) => [
      txn`
        SELECT id, lead_id
        FROM ai_lead_analyses
        WHERE id = ${analysisId}
          AND lead_id = ${leadId}
        FOR UPDATE
      `,
      txn`
        UPDATE ai_lead_feedback
        SET superseded_by = ${newId}
        WHERE analysis_id = ${analysisId}
          AND superseded_by IS NULL
      `,
      txn`
        INSERT INTO ai_lead_feedback (
          id,
          analysis_id,
          lead_id,
          created_by,
          decision,
          corrected_suggested_next_action,
          correction_note
        )
        SELECT
          ${newId},
          a.id,
          a.lead_id,
          ${createdBy},
          ${validated.decision},
          ${validated.correctedSuggestedNextAction},
          ${validated.correctionNote}
        FROM ai_lead_analyses a
        WHERE a.id = ${analysisId}
          AND a.lead_id = ${leadId}
        RETURNING
          id, analysis_id, lead_id, created_at, created_by, decision,
          corrected_suggested_next_action, correction_note, superseded_by
      `,
    ]);
  } catch (error) {
    console.error("[cc/ai-lead-feedback] submit failed", error?.message || error);
    return { ok: false, error: "persist_failed" };
  }

  const lockedRows = results?.[0];
  const analysisRow = Array.isArray(lockedRows) ? lockedRows[0] : lockedRows;
  if (!analysisRow?.id) {
    return { ok: false, error: "analysis_not_found" };
  }

  const insertedRows = results?.[2];
  const row = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
  if (!row?.id) return { ok: false, error: "insert_failed" };

  return { ok: true, feedback: row };
}
