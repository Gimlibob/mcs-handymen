/**
 * Google Calendar sync status values (Phase GC-1).
 */

export const GOOGLE_SYNC_STATUSES = [
  "none",
  "pending",
  "synced",
  "error",
  "missing_remote",
];

export const GOOGLE_CONNECTION_STATUSES = ["connected", "revoked", "error"];

export function isValidGoogleSyncStatus(value) {
  return GOOGLE_SYNC_STATUSES.includes(value);
}

/** Preferred OAuth scope when live provider is wired (GC-2+). */
export const GOOGLE_CALENDAR_PREFERRED_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";
