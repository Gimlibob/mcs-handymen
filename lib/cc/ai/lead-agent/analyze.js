import { buildLeadAgentContext } from "./context.js";
import { runLeadAgentCompletion } from "./run.js";
import { insertLeadAnalysis } from "../../db/ai-lead-analyses.js";
import { getLeadById } from "../../db/leads.js";

/**
 * Core Phase 4A analyze path (no auth). Used by server action + tests.
 * @param {string} leadId
 * @param {{ complete?: Function, createdBy?: string }} [options]
 */
export async function analyzeLeadReadonly(leadId, options = {}) {
  if (typeof leadId !== "string" || leadId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  const before = await getLeadById(leadId);
  if (!before) return { ok: false, error: "not_found" };

  const packed = await buildLeadAgentContext(leadId);
  if (!packed) return { ok: false, error: "not_found" };

  const completion = await runLeadAgentCompletion({
    userPrompt: packed.userPrompt,
    complete: options.complete,
  });

  if (!completion.ok) {
    return { ok: false, error: completion.error };
  }

  const saved = await insertLeadAnalysis({
    leadId,
    provider: completion.provider,
    model: completion.model,
    promptVersion: completion.promptVersion,
    inputFingerprint: packed.fingerprint,
    crmNextActionSnapshot: packed.crmNextAction,
    analysis: completion.analysis,
    meta: completion.meta,
    createdBy: options.createdBy || "owner",
  });

  if (!saved.ok) {
    return { ok: false, error: saved.error || "persist_failed" };
  }

  const after = await getLeadById(leadId);
  if (
    !after ||
    after.status !== before.status ||
    String(after.updated_at) !== String(before.updated_at)
  ) {
    console.error("[cc/lead-agent] unexpected CRM mutation after analysis");
    return { ok: false, error: "crm_guard_failed" };
  }

  return {
    ok: true,
    analysisId: saved.analysis.id,
    analysis: saved.analysis.analysis,
    provider: saved.analysis.provider,
    model: saved.analysis.model,
    promptVersion: saved.analysis.prompt_version,
    crmNextActionSnapshot: saved.analysis.crm_next_action_snapshot,
    createdAt: saved.analysis.created_at,
    leadBefore: before,
    leadAfter: after,
  };
}
