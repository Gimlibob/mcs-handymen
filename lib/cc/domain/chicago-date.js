/**
 * Civil-date helpers for America/Chicago (MCS Texas operations).
 * Prefer YYYY-MM-DD strings — never persist via new Date('YYYY-MM-DD') UTC shift.
 */

export const BUSINESS_TIMEZONE = "America/Chicago";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidCalendarDateString(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [, y, m, d] = value.match(DATE_RE);
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Normalize form/API input to YYYY-MM-DD or null.
 * @param {unknown} value
 */
export function normalizeCalendarDateInput(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isValidCalendarDateString(trimmed)) return null;
  return trimmed;
}

/**
 * Current civil date in America/Chicago as YYYY-MM-DD.
 * @param {Date} [now]
 */
export function chicagoToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * @param {string} ymd YYYY-MM-DD
 * @param {number} deltaDays
 */
export function addCalendarDays(ymd, deltaDays) {
  if (!isValidCalendarDateString(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Monday-start week containing the given civil date (or Chicago today).
 * @param {string | null} [anchorYmd]
 * @returns {{ weekStart: string, weekEnd: string, days: string[] }}
 */
export function mondayWeekContaining(anchorYmd = null) {
  const anchor = anchorYmd && isValidCalendarDateString(anchorYmd) ? anchorYmd : chicagoToday();
  const [y, m, d] = anchor.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0 Sun .. 6 Sat → Monday-based offset
  const dow = utc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = addCalendarDays(anchor, mondayOffset);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(addCalendarDays(weekStart, i));
  }
  return { weekStart, weekEnd: days[6], days };
}

/**
 * Format YYYY-MM-DD for owner display without timezone shift.
 * @param {string | Date | null | undefined} value
 */
export function formatCalendarDate(value) {
  if (!value) return "—";
  let ymd = null;
  if (typeof value === "string") {
    if (isValidCalendarDateString(value.slice(0, 10))) {
      ymd = value.slice(0, 10);
    }
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Neon DATE often arrives as Date at UTC midnight — use UTC parts
    const yy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(value.getUTCDate()).padStart(2, "0");
    ymd = `${yy}-${mm}-${dd}`;
  }
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Normalize a DB DATE value to YYYY-MM-DD string.
 * @param {unknown} value
 */
export function toCalendarDateString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const slice = value.slice(0, 10);
    return isValidCalendarDateString(slice) ? slice : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(value.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}
