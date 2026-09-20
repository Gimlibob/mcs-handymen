/**
 * Job scheduling domain (Phase 5B).
 * planned schedule = scheduled_date + scheduled_window (am|pm|flex).
 */

import { getAllowedNextJobStatuses } from "./job-status.js";

export const SCHEDULE_WINDOWS = ["am", "pm", "flex"];

export const SCHEDULE_WINDOW_LABELS = {
  am: "AM",
  pm: "PM",
  flex: "Flex",
};

export function isValidScheduleWindow(window) {
  return SCHEDULE_WINDOWS.includes(window);
}

export function scheduleWindowLabel(window) {
  if (!window) return "—";
  return SCHEDULE_WINDOW_LABELS[window] || window;
}

/** Display / calendar order: AM → PM → Flex (not alphabetical). */
export function scheduleWindowSortRank(window) {
  if (window === "am") return 0;
  if (window === "pm") return 1;
  if (window === "flex") return 2;
  return 3;
}

/**
 * Deterministic day ordering for calendar chips.
 * Window rank, then authorized_at ASC, then id.
 */
export function compareJobsForCalendarDay(a, b) {
  const wa = scheduleWindowSortRank(a?.scheduled_window);
  const wb = scheduleWindowSortRank(b?.scheduled_window);
  if (wa !== wb) return wa - wb;
  const ta = new Date(a?.authorized_at || 0).getTime();
  const tb = new Date(b?.authorized_at || 0).getTime();
  const na = Number.isNaN(ta) ? 0 : ta;
  const nb = Number.isNaN(tb) ? 0 : tb;
  if (na !== nb) return na - nb;
  const ida = typeof a?.id === "string" ? a.id : "";
  const idb = typeof b?.id === "string" ? b.id : "";
  return ida < idb ? -1 : ida > idb ? 1 : 0;
}

export function normalizeScheduleWindow(value, { defaultFlex = false } = {}) {
  if (value === null || value === undefined || value === "") {
    return defaultFlex ? "flex" : null;
  }
  if (typeof value !== "string") return null;
  const w = value.trim().toLowerCase();
  if (!isValidScheduleWindow(w)) return null;
  return w;
}

/** Needs Scheduling queue: authorized null-date OR legacy scheduled null-date. */
export function needsScheduling(job) {
  if (!job || typeof job !== "object") return false;
  const date = job.scheduled_date ?? null;
  if (date) return false;
  return job.status === "authorized" || job.status === "scheduled";
}

/** Legacy: status scheduled but no date yet. */
export function isLegacyNeedsDate(job) {
  return Boolean(
    job && job.status === "scheduled" && !(job.scheduled_date ?? null)
  );
}

export function canScheduleJob(job) {
  return Boolean(job && job.status === "authorized" && !(job.scheduled_date ?? null));
}

/** Legacy scheduled + null date — set first date without status change. */
export function canSetScheduleDate(job) {
  return isLegacyNeedsDate(job);
}

export function canRescheduleJob(job) {
  return Boolean(
    job && job.status === "scheduled" && (job.scheduled_date ?? null)
  );
}

export function canUnscheduleJob(job) {
  return canRescheduleJob(job);
}

/** Schedule fields are read-only once work has started or ended. */
export function isScheduleReadOnly(job) {
  if (!job) return true;
  return (
    job.status === "in_progress" ||
    job.status === "completed" ||
    job.status === "cancelled"
  );
}

/**
 * Status transitions that must use dedicated schedule actions (not generic status form).
 */
export function isScheduleManagedTransition(from, to) {
  if (from === "authorized" && to === "scheduled") return true;
  if (from === "scheduled" && to === "authorized") return true;
  return false;
}

/**
 * Next statuses for the generic Job status form (excludes schedule-managed transitions).
 */
export function getAllowedNextJobStatusesForStatusForm(from) {
  return getAllowedNextJobStatuses(from).filter(
    (to) => !isScheduleManagedTransition(from, to)
  );
}
