/**
 * Owner account domain constants (Auth Phase A).
 * Workers are never owner accounts.
 */

/** Confirmed Command Center owner identity for bootstrap. */
export const CANONICAL_OWNER_EMAIL = "info@mcshandymen.com";

export function normalizeOwnerEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 200);
}

export function isCanonicalOwnerEmail(value) {
  return normalizeOwnerEmail(value) === CANONICAL_OWNER_EMAIL;
}
