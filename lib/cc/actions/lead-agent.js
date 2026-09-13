"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { analyzeLeadReadonly } from "@/lib/cc/ai/lead-agent/analyze";
import { submitLeadAnalysisFeedback } from "@/lib/cc/db/ai-lead-feedback";

/**
 * On-demand Lead Agent analysis (Phase 4A).
 * Read-only w.r.t. CRM truth — writes only to ai_lead_analyses.
 */
export async function analyzeLeadAction(leadId) {
  await requireOwner();

  const result = await analyzeLeadReadonly(leadId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/command-center/leads/${leadId}`);

  return {
    ok: true,
    analysisId: result.analysisId,
    analysis: result.analysis,
    provider: result.provider,
    model: result.model,
    promptVersion: result.promptVersion,
    crmNextActionSnapshot: result.crmNextActionSnapshot,
    createdAt: result.createdAt,
  };
}

/**
 * Phase 4A.6 — record owner Accept / Reject / Correct on an analysis.
 * Learning signal only. Does not mutate CRM, notes, tags, status, or Playbook.
 * Does not call an LLM.
 */
export async function submitLeadAnalysisFeedbackAction({
  leadId,
  analysisId,
  decision,
  correctedSuggestedNextAction = null,
  correctionNote = null,
} = {}) {
  await requireOwner();

  const result = await submitLeadAnalysisFeedback({
    leadId,
    analysisId,
    decision,
    correctedSuggestedNextAction,
    correctionNote,
    createdBy: "owner",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/command-center/leads/${leadId}`);

  return {
    ok: true,
    feedbackId: result.feedback.id,
    decision: result.feedback.decision,
  };
}
