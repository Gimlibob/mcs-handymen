/**
 * Manual owner-only operational tags (Phase 3.5).
 * No AI. No opaque scores.
 * repeat_customer is NOT a tag — derived from lead count.
 * good_payer is deferred until payment data exists.
 */
export const CUSTOMER_TAG_KEYS = [
  "easy_to_work_with",
  "price_sensitive",
  "frequent_negotiator",
  "communication_issues",
  "scheduling_issues",
  "requires_follow_up",
];

const TAG_LABELS = {
  easy_to_work_with: "Easy to work with",
  price_sensitive: "Price sensitive",
  frequent_negotiator: "Frequent negotiator",
  communication_issues: "Communication issues",
  scheduling_issues: "Scheduling issues",
  requires_follow_up: "Requires follow-up",
};

export function isValidCustomerTag(tagKey) {
  return CUSTOMER_TAG_KEYS.includes(tagKey);
}

export function customerTagLabel(tagKey) {
  return TAG_LABELS[tagKey] || tagKey;
}
