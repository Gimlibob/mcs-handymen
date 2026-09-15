/**
 * Worker status domain (Phase 4B.1).
 * Workers are operational records only — not authentication accounts.
 */

export const WORKER_STATUSES = ["active", "inactive"];

export const WORKER_STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
};

export function isValidWorkerStatus(status) {
  return WORKER_STATUSES.includes(status);
}

export function workerStatusLabel(status) {
  return WORKER_STATUS_LABELS[status] || status;
}

export function isWorkerAssignable(status) {
  return status === "active";
}
