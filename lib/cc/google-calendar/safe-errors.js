/**
 * Owner-safe Google Calendar error messages (no raw payloads).
 */

import { GoogleCalendarProviderError } from "./provider.js";

/**
 * Connection / calendar lifecycle messages.
 */
export function safeOwnerError(err) {
  if (err instanceof GoogleCalendarProviderError) {
    if (err.status === 401) return "Google Calendar authorization expired";
    if (err.status === 403) return "Google Calendar permission denied";
    if (err.status === 404) return "MCS Jobs calendar not found";
    if (err.status === 429 || (err.status && err.status >= 500)) {
      return "Google Calendar temporarily unavailable";
    }
    if (err.code === "timeout") {
      return "Google Calendar temporarily unavailable";
    }
  }
  return "Google Calendar connection error";
}

/**
 * Per-Job sync messages (404 usually means missing event, not calendar).
 */
export function safeJobSyncError(err) {
  if (err instanceof GoogleCalendarProviderError) {
    if (err.status === 401) return "Google Calendar authorization expired";
    if (err.status === 403) return "Google Calendar permission denied";
    if (err.status === 404) return "Google Calendar event missing";
    if (err.status === 429 || (err.status && err.status >= 500)) {
      return "Google Calendar temporarily unavailable";
    }
    if (err.code === "timeout") {
      return "Google Calendar temporarily unavailable";
    }
  }
  return "Google Calendar sync error";
}
