/** Lead pipeline statuses and allowed manual transitions (Phase 3). */

export const LEAD_STATUSES = [
  "new",
  "waiting_info",
  "ready_for_estimate",
  "estimate_draft",
  "estimate_pending_review",
  "estimate_sent",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "follow_up",
  "closed_won",
  "closed_lost",
];

export const LEAD_STATUS_LABELS = {
  new: "New Leads",
  waiting_info: "Waiting Info",
  ready_for_estimate: "Ready for Estimate",
  estimate_draft: "Estimate Draft",
  estimate_pending_review: "Estimate Pending Review",
  estimate_sent: "Estimate Sent",
  accepted: "Accepted",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  follow_up: "Follow Up",
  closed_won: "Closed Won",
  closed_lost: "Lost",
};

/** Dashboard counter tiles (order matters). */
export const DASHBOARD_STATUS_TILES = [
  "new",
  "waiting_info",
  "ready_for_estimate",
  "estimate_pending_review",
  "estimate_sent",
  "accepted",
  "scheduled",
  "completed",
  "closed_lost",
];

/** High-level pipeline strip stages (visual overview only). */
export const DASHBOARD_PIPELINE_STAGES = [
  "new",
  "waiting_info",
  "ready_for_estimate",
  "estimate_sent",
  "accepted",
  "scheduled",
  "completed",
];

const TERMINAL = new Set(["closed_won", "closed_lost"]);

/**
 * Allowed next statuses from each status.
 * Includes forward workflow steps, limited back-steps for corrections, and closed_lost.
 */
export const LEAD_TRANSITIONS = {
  new: ["waiting_info", "ready_for_estimate", "closed_lost"],
  waiting_info: ["ready_for_estimate", "new", "closed_lost"],
  ready_for_estimate: ["estimate_draft", "waiting_info", "closed_lost"],
  estimate_draft: ["estimate_pending_review", "ready_for_estimate", "closed_lost"],
  estimate_pending_review: ["estimate_sent", "estimate_draft", "closed_lost"],
  estimate_sent: ["accepted", "estimate_pending_review", "closed_lost"],
  accepted: ["scheduled", "closed_lost"],
  scheduled: ["in_progress", "accepted", "closed_lost"],
  in_progress: ["completed", "scheduled", "closed_lost"],
  completed: ["follow_up", "closed_won"],
  follow_up: ["closed_won", "completed"],
  closed_won: [],
  closed_lost: [],
};

export function isValidLeadStatus(status) {
  return LEAD_STATUSES.includes(status);
}

export function canTransitionLeadStatus(from, to) {
  if (!isValidLeadStatus(from) || !isValidLeadStatus(to)) return false;
  if (from === to) return false;
  return (LEAD_TRANSITIONS[from] || []).includes(to);
}

export function getAllowedNextStatuses(from) {
  if (!isValidLeadStatus(from)) return [];
  return LEAD_TRANSITIONS[from] || [];
}

export function isTerminalStatus(status) {
  return TERMINAL.has(status);
}

export function statusLabel(status) {
  return LEAD_STATUS_LABELS[status] || status;
}

/**
 * Deterministic "what to do now" hint from status (no AI).
 * Primary workflow statuses match the Phase 3 UX brief.
 */
export const LEAD_NEXT_ACTIONS = {
  new: "Review lead",
  waiting_info: "Contact customer",
  ready_for_estimate: "Prepare estimate",
  estimate_draft: "Finish estimate draft",
  estimate_pending_review: "Review estimate",
  estimate_sent: "Follow up",
  accepted: "Schedule job",
  scheduled: "Confirm schedule",
  in_progress: "Complete the job",
  completed: "Close out or follow up",
  follow_up: "Follow up with customer",
  closed_won: null,
  closed_lost: null,
};

export function getNextAction(status) {
  if (!isValidLeadStatus(status)) return null;
  return LEAD_NEXT_ACTIONS[status] ?? null;
}
