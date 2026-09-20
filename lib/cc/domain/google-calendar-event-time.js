/**
 * America/Chicago timed / all-day mapping for Google Calendar events.
 * Pure helpers — no network, no Date('YYYY-MM-DD') UTC shift.
 */

import {
  isValidCalendarDateString,
  normalizeCalendarDateInput,
} from "./chicago-date.js";
import { normalizeScheduleWindow } from "./job-scheduling.js";

export const GOOGLE_EVENT_TIMEZONE = "America/Chicago";

/**
 * @param {string} scheduledDate YYYY-MM-DD
 * @param {string | null | undefined} scheduledWindow am|pm|flex
 * @returns {{
 *   kind: 'timed' | 'all_day',
 *   timeZone: string,
 *   startDate?: string,
 *   endDate?: string,
 *   startDateTime?: string,
 *   endDateTime?: string
 * } | null}
 */
export function buildGoogleEventTimeRange(scheduledDate, scheduledWindow) {
  const date = normalizeCalendarDateInput(scheduledDate);
  if (!date || !isValidCalendarDateString(date)) return null;

  const window = normalizeScheduleWindow(scheduledWindow, { defaultFlex: true });
  if (!window) return null;

  if (window === "flex") {
    // All-day exclusive end = next calendar day
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const ey = next.getUTCFullYear();
    const em = String(next.getUTCMonth() + 1).padStart(2, "0");
    const ed = String(next.getUTCDate()).padStart(2, "0");
    return {
      kind: "all_day",
      timeZone: GOOGLE_EVENT_TIMEZONE,
      startDate: date,
      endDate: `${ey}-${em}-${ed}`,
    };
  }

  const startHour = window === "am" ? 8 : 13;
  const endHour = window === "am" ? 12 : 17;
  const startDateTime = `${date}T${String(startHour).padStart(2, "0")}:00:00`;
  const endDateTime = `${date}T${String(endHour).padStart(2, "0")}:00:00`;

  return {
    kind: "timed",
    timeZone: GOOGLE_EVENT_TIMEZONE,
    startDateTime,
    endDateTime,
  };
}
