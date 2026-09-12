/**
 * Normalize email for Customer matching (Phase 3.5).
 * Matching is email_normalized only — never by name.
 */
export function normalizeCustomerEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * @param {number} leadCount
 * @returns {"new" | "returning"}
 */
export function getCustomerRecurrence(leadCount) {
  const n = Number(leadCount) || 0;
  return n > 1 ? "returning" : "new";
}

export function customerRecurrenceLabel(leadCount) {
  return getCustomerRecurrence(leadCount) === "returning"
    ? "Returning Customer"
    : "New Customer";
}
