/**
 * MCS Playbook domain constants (Phase 4A.5).
 * Approve + deterministic Lead Agent retrieval: Phase 4A.5.c.
 */

/** Categories the Lead Agent may retrieve when approved + validated. */
export const LEAD_AGENT_PLAYBOOK_CATEGORIES = [
  "commercial_policy",
  "service_offered",
  "service_not_offered",
  "service_area",
  "lead_qualification",
];

/** Hard cap on Playbook rows injected into Lead Agent context. */
export const LEAD_AGENT_PLAYBOOK_MAX_ENTRIES = 8;

export const LEAD_AGENT_PLAYBOOK_SUMMARY_MAX = 240;
export const LEAD_AGENT_PLAYBOOK_BODY_MAX = 800;

export const PLAYBOOK_CATEGORIES = [
  "commercial_policy",
  "service_offered",
  "service_not_offered",
  "service_area",
  "lead_qualification",
  "pricing_rule",
  "work_procedure",
  "materials",
  "tools",
  "technical_spec",
  "manufacturer_ref",
  "safety",
  "quality_standard",
  "employee_procedure",
  "service_knowledge",
];

export const PLAYBOOK_SENSITIVITIES = [
  "commercial",
  "operational",
  "technical_critical",
  "internal_employee",
];

/** Distinguishes owner-validated knowledge from ideas / open discussion. */
export const PLAYBOOK_VALIDATION_STATES = ["validated", "hypothesis", "discussion"];

export const PLAYBOOK_REVISION_STATUSES = ["draft", "approved", "retired"];

export function isValidPlaybookCategory(value) {
  return PLAYBOOK_CATEGORIES.includes(value);
}

export function isValidPlaybookSensitivity(value) {
  return PLAYBOOK_SENSITIVITIES.includes(value);
}

export function isValidPlaybookValidationState(value) {
  return PLAYBOOK_VALIDATION_STATES.includes(value);
}

export function isValidPlaybookRevisionStatus(value) {
  return PLAYBOOK_REVISION_STATUSES.includes(value);
}

const CATEGORY_LABELS = {
  commercial_policy: "Commercial policy",
  service_offered: "Service we offer",
  service_not_offered: "Service we do not offer",
  service_area: "Service area",
  lead_qualification: "Lead qualification",
  pricing_rule: "Pricing rule",
  work_procedure: "Work procedure",
  materials: "Materials",
  tools: "Tools",
  technical_spec: "Technical specification",
  manufacturer_ref: "Manufacturer reference",
  safety: "Safety",
  quality_standard: "Quality standard",
  employee_procedure: "Employee procedure",
  service_knowledge: "Service-specific knowledge",
};

const SENSITIVITY_LABELS = {
  commercial: "Commercial",
  operational: "Operational",
  technical_critical: "Technical (critical)",
  internal_employee: "Internal — employees only",
};

const SENSITIVITY_HINTS = {
  commercial: "Money and policy rules (minimums, what we charge for).",
  operational: "How MCS runs leads and jobs day to day.",
  technical_critical: "Specs that must never be guessed (anchors, screws, products, cure times).",
  internal_employee: "Staff-only procedures — not for customer-facing agents later.",
};

const VALIDATION_STATE_LABELS = {
  validated: "Validated MCS rule",
  hypothesis: "Working hypothesis",
  discussion: "Discussion / not decided",
};

const REVISION_STATUS_LABELS = {
  draft: "Draft",
  approved: "Approved",
  retired: "Retired",
};

/** Stored in service_keys when the rule applies to every MCS service. */
export const PLAYBOOK_ALL_SERVICES_KEY = "*";

export function playbookCategoryLabel(value) {
  return CATEGORY_LABELS[value] || value;
}

export function playbookSensitivityLabel(value) {
  return SENSITIVITY_LABELS[value] || value;
}

export function playbookSensitivityHint(value) {
  return SENSITIVITY_HINTS[value] || "";
}

export function playbookValidationStateLabel(value) {
  return VALIDATION_STATE_LABELS[value] || value;
}

export function playbookRevisionStatusLabel(value) {
  return REVISION_STATUS_LABELS[value] || value;
}

/**
 * Parse service selection from form values.
 * "all" / "*" → ["*"]. Otherwise keep known service ids only (plus legacy free-text keys).
 */
export function parsePlaybookServiceKeysInput(raw) {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const cleaned = values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  if (cleaned.some((v) => v === "all" || v === PLAYBOOK_ALL_SERVICES_KEY)) {
    return [PLAYBOOK_ALL_SERVICES_KEY];
  }
  return normalizePlaybookStringList(cleaned);
}

export function playbookAppliesToLabel(serviceKeys) {
  const keys = Array.isArray(serviceKeys) ? serviceKeys : [];
  if (keys.length === 0 || keys.includes(PLAYBOOK_ALL_SERVICES_KEY)) {
    return "All services";
  }
  return keys.join(", ");
}

/**
 * Parse comma/newline separated form input into string list.
 */
export function parsePlaybookListInput(raw) {
  if (typeof raw !== "string") return [];
  return normalizePlaybookStringList(
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Normalize slug: trim, lowercase, collapse spaces to hyphens, allow [a-z0-9-_].
 * @returns {string} empty string if invalid after normalize
 */
export function normalizePlaybookSlug(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizePlaybookStringList(value, { maxItems = 40, maxLen = 80 } = {}) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, maxLen);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}
