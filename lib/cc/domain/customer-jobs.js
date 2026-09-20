/**
 * Customer ↔ Job presentation helpers (Phase 5A / 5B).
 *
 * Phase 5B: prefer scheduled_date in jobDisplayDate / upcoming sort when present.
 */

import { isTerminalJobStatus } from "./job-status.js";

/** Non-cancelled current/open Jobs shown under Upcoming. */
export const CUSTOMER_JOB_UPCOMING_STATUSES = [
  "authorized",
  "scheduled",
  "in_progress",
];

/** Terminal Jobs shown under History. */
export const CUSTOMER_JOB_HISTORY_STATUSES = ["completed", "cancelled"];

export function isCustomerJobUpcoming(status) {
  return CUSTOMER_JOB_UPCOMING_STATUSES.includes(status);
}

export function isCustomerJobHistory(status) {
  return CUSTOMER_JOB_HISTORY_STATUSES.includes(status);
}

/**
 * Best available date for list display (Phase 5A).
 * Phase 5B: prefer scheduled_date when present.
 */
export function jobDisplayDate(job) {
  if (!job || typeof job !== "object") return null;
  if (job.scheduled_date) return job.scheduled_date;
  if (job.status === "completed" && job.completed_at) return job.completed_at;
  if (job.status === "cancelled" && job.cancelled_at) return job.cancelled_at;
  return job.authorized_at || job.created_at || null;
}

/**
 * Sort key for upcoming: dated jobs by scheduled_date ASC (earlier first),
 * then undated actives by authorized_at ASC (oldest backlog first).
 * Returns [tier, time] comparable via customerJobUpcomingCompare.
 */
export function customerJobUpcomingSortParts(job) {
  const ymd =
    typeof job?.scheduled_date === "string"
      ? job.scheduled_date
      : job?.scheduled_date
        ? String(job.scheduled_date).slice(0, 10)
        : null;
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const t = new Date(`${ymd}T00:00:00.000Z`).getTime();
    return [0, Number.isNaN(t) ? 0 : t];
  }
  const t = new Date(job?.authorized_at || job?.created_at || 0).getTime();
  return [1, Number.isNaN(t) ? 0 : t];
}

export function customerJobUpcomingCompare(a, b) {
  const pa = customerJobUpcomingSortParts(a);
  const pb = customerJobUpcomingSortParts(b);
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  return pa[1] - pb[1];
}

/**
 * Sort key ms for upcoming (legacy helper — prefer customerJobUpcomingCompare).
 * Phase 5B: dated jobs sort earlier (negative offset style via compare).
 */
export function customerJobUpcomingSortKey(job) {
  const [tier, t] = customerJobUpcomingSortParts(job);
  return tier * 1e15 + t;
}

/**
 * Sort key ms for history: most recently completed/cancelled first.
 */
export function customerJobHistorySortKey(job) {
  const raw =
    job?.completed_at || job?.cancelled_at || job?.updated_at || job?.authorized_at;
  const t = new Date(raw || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Partition a flat job list into upcoming + history (no duplicates).
 * @param {object[]} jobs
 */
export function partitionCustomerJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const upcoming = list
    .filter((j) => isCustomerJobUpcoming(j.status))
    .sort(customerJobUpcomingCompare);
  const history = list
    .filter((j) => isCustomerJobHistory(j.status))
    .sort((a, b) => customerJobHistorySortKey(b) - customerJobHistorySortKey(a));
  return { upcoming, history };
}

/**
 * Computed job summary for Customer Profile (never stored on customers).
 * @param {object[]} jobs
 */
export function summarizeCustomerJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  let completedJobs = 0;
  let upcomingJobs = 0;
  let firstJobAt = null;
  let lastJobAt = null;

  for (const job of list) {
    if (isCustomerJobUpcoming(job.status)) upcomingJobs += 1;
    if (job.status === "completed") completedJobs += 1;

    const auth = job.authorized_at ? new Date(job.authorized_at).getTime() : NaN;
    if (!Number.isNaN(auth)) {
      if (firstJobAt === null || auth < firstJobAt) firstJobAt = auth;
      if (lastJobAt === null || auth > lastJobAt) lastJobAt = auth;
    }

    const done = job.completed_at ? new Date(job.completed_at).getTime() : NaN;
    if (!Number.isNaN(done) && (lastJobAt === null || done > lastJobAt)) {
      lastJobAt = done;
    }
    const cancelled = job.cancelled_at ? new Date(job.cancelled_at).getTime() : NaN;
    if (!Number.isNaN(cancelled) && (lastJobAt === null || cancelled > lastJobAt)) {
      lastJobAt = cancelled;
    }
  }

  return {
    totalJobs: list.length,
    completedJobs,
    upcomingJobs,
    firstJobAt: firstJobAt === null ? null : new Date(firstJobAt).toISOString(),
    lastJobAt: lastJobAt === null ? null : new Date(lastJobAt).toISOString(),
  };
}

/**
 * Operational job-history label (separate from Lead recurrence).
 * @param {number} totalJobs
 */
export function customerJobHistoryLabel(totalJobs) {
  const n = Number(totalJobs) || 0;
  return n > 0 ? "Returning (jobs)" : "No job history";
}

export function truncateScopeSummary(text, max = 120) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Sanity: terminal statuses are exactly history set. */
export function assertJobPartitionCoverage(status) {
  if (isTerminalJobStatus(status)) return isCustomerJobHistory(status);
  return isCustomerJobUpcoming(status);
}
