/**
 * Phase 4A.6 — human feedback on Lead Agent analyses.
 * Learning signal only. Never mutates CRM or Playbook.
 */

export const AI_LEAD_FEEDBACK_DECISIONS = ["accepted", "rejected", "corrected"];

export const CORRECTED_NEXT_ACTION_MAX = 500;
export const CORRECTION_NOTE_MAX = 2000;

/**
 * @param {{
 *   decision: unknown,
 *   correctedSuggestedNextAction?: unknown,
 *   correctionNote?: unknown,
 * }} input
 * @returns {{ ok: true, decision: string, correctedSuggestedNextAction: string|null, correctionNote: string|null } | { ok: false, error: string }}
 */
export function validateLeadAnalysisFeedback(input) {
  const decision =
    typeof input?.decision === "string" ? input.decision.trim() : "";
  if (!AI_LEAD_FEEDBACK_DECISIONS.includes(decision)) {
    return { ok: false, error: "invalid_decision" };
  }

  let correctedSuggestedNextAction = null;
  if (
    input?.correctedSuggestedNextAction != null &&
    String(input.correctedSuggestedNextAction).trim() !== ""
  ) {
    correctedSuggestedNextAction = String(input.correctedSuggestedNextAction).trim();
  }

  let correctionNote = null;
  if (input?.correctionNote != null && String(input.correctionNote).trim() !== "") {
    correctionNote = String(input.correctionNote).trim();
  }

  if (decision === "corrected") {
    if (!correctedSuggestedNextAction) {
      return { ok: false, error: "corrected_action_required" };
    }
    if (correctedSuggestedNextAction.length > CORRECTED_NEXT_ACTION_MAX) {
      return { ok: false, error: "corrected_action_too_long" };
    }
  } else if (correctedSuggestedNextAction) {
    return { ok: false, error: "corrected_action_not_allowed" };
  }

  if (correctionNote && correctionNote.length > CORRECTION_NOTE_MAX) {
    return { ok: false, error: "correction_note_too_long" };
  }

  return {
    ok: true,
    decision,
    correctedSuggestedNextAction,
    correctionNote,
  };
}

export function feedbackDecisionLabel(decision) {
  if (decision === "accepted") return "Accepted";
  if (decision === "rejected") return "Rejected";
  if (decision === "corrected") return "Corrected";
  return decision || "—";
}
