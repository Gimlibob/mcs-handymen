"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { analyzeLeadReadonly } from "@/lib/cc/ai/lead-agent/analyze";

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
