/**
 * Job lifecycle domain (Phase 4B.0).
 * Separate from Lead sales pipeline. No automatic Lead↔Job sync.
 */

export const JOB_STATUSES = [
  "authorized",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

export const JOB_STATUS_LABELS = {
  authorized: "Authorized",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Lead statuses that may explicitly create a Job (owner action only). */
export const JOB_CREATE_ELIGIBLE_LEAD_STATUSES = [
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
];

/**
 * Allowed Job status transitions.
 * Terminal: completed, cancelled.
 */
export const JOB_TRANSITIONS = {
  authorized: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "authorized", "cancelled"],
  in_progress: ["completed", "scheduled", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidJobStatus(status) {
  return JOB_STATUSES.includes(status);
}

export function canTransitionJobStatus(from, to) {
  if (!isValidJobStatus(from) || !isValidJobStatus(to)) return false;
  if (from === to) return false;
  return (JOB_TRANSITIONS[from] || []).includes(to);
}

export function getAllowedNextJobStatuses(from) {
  if (!isValidJobStatus(from)) return [];
  return JOB_TRANSITIONS[from] || [];
}

export function jobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] || status;
}

export function isLeadEligibleForJobCreate(leadStatus) {
  return JOB_CREATE_ELIGIBLE_LEAD_STATUSES.includes(leadStatus);
}

export function isTerminalJobStatus(status) {
  return status === "completed" || status === "cancelled";
}
