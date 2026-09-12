/**
 * Lead Agent Phase 4A — structured analysis schema + server-side validation.
 * No pricing fields. No CRM mutation fields.
 */

export const OPERATIONAL_COMPLEXITY = ["low", "medium", "high"];
export const CUSTOMER_RECURRENCE = ["new", "returning", "unknown"];

/** OpenAI strict json_schema for structured outputs. */
export const LEAD_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "factual_summary",
    "missing_information",
    "questions_to_ask",
    "risks_and_ambiguities",
    "operational_complexity",
    "complexity_rationale",
    "customer_context",
    "uncertainties",
    "suggested_next_action",
  ],
  properties: {
    factual_summary: { type: "string" },
    missing_information: {
      type: "array",
      items: { type: "string" },
    },
    questions_to_ask: {
      type: "array",
      items: { type: "string" },
    },
    risks_and_ambiguities: {
      type: "array",
      items: { type: "string" },
    },
    operational_complexity: {
      type: "string",
      enum: OPERATIONAL_COMPLEXITY,
    },
    complexity_rationale: { type: "string" },
    customer_context: {
      type: "object",
      additionalProperties: false,
      required: ["recurrence", "relevant_facts", "owner_tags"],
      properties: {
        recurrence: {
          type: "string",
          enum: CUSTOMER_RECURRENCE,
        },
        relevant_facts: {
          type: "array",
          items: { type: "string" },
        },
        owner_tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    uncertainties: {
      type: "array",
      items: { type: "string" },
    },
    suggested_next_action: { type: "string" },
  },
};

const FORBIDDEN_ANALYSIS_KEYS = new Set([
  "price",
  "prices",
  "pricing",
  "estimate",
  "estimates",
  "quote_amount",
  "cost",
  "costs",
  "draft_reply",
  "email_draft",
  "message_to_send",
]);

function asStringArray(value, { maxItems = 20, maxLen = 500 } = {}) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value.slice(0, maxItems)) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim().slice(0, maxLen);
    if (trimmed.length > 0) out.push(trimmed);
  }
  return out;
}

function asNonEmptyString(value, maxLen = 4000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Risks that claim the lead needs more factual detail (service-agnostic).
 * Used only for coherence checks — not for inventing domain-specific fields.
 */
const RISK_IMPLIES_DETAIL_GAP =
  /\b(vague|unclear|incomplete|insufficient|missing|unknown|unspecified|not\s+(enough|clear|specified|stated)|needs?\s+more|more\s+detail|lack(?:s|ing)?|ambiguous)\b/i;

/**
 * Cross-field coherence for Phase 4A sections.
 * @param {{ missing_information: string[], questions_to_ask: string[], risks_and_ambiguities: string[] }} analysis
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function checkLeadAnalysisCoherence(analysis) {
  const missing = analysis?.missing_information;
  const questions = analysis?.questions_to_ask;
  const risks = analysis?.risks_and_ambiguities;
  if (!Array.isArray(missing) || !Array.isArray(questions) || !Array.isArray(risks)) {
    return { ok: false, error: "coherence_shape" };
  }

  if (questions.length > 0 && missing.length === 0) {
    return { ok: false, error: "coherence_questions_without_missing" };
  }

  const riskImpliesGap = risks.some((r) => typeof r === "string" && RISK_IMPLIES_DETAIL_GAP.test(r));
  if (riskImpliesGap && missing.length === 0) {
    return { ok: false, error: "coherence_risks_without_missing" };
  }

  return { ok: true };
}

/**
 * Validate and normalize model JSON. Rejects unknown top-level keys and pricing fields.
 * @returns {{ ok: true, analysis: object } | { ok: false, error: string }}
 */
export function validateLeadAnalysis(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_shape" };
  }

  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_ANALYSIS_KEYS.has(key.toLowerCase())) {
      return { ok: false, error: "forbidden_field" };
    }
    if (!(key in LEAD_ANALYSIS_JSON_SCHEMA.properties)) {
      return { ok: false, error: "unknown_field" };
    }
  }

  const factual_summary = asNonEmptyString(raw.factual_summary, 4000);
  if (!factual_summary) return { ok: false, error: "factual_summary" };

  const missing_information = asStringArray(raw.missing_information);
  if (!missing_information) return { ok: false, error: "missing_information" };

  const questions_to_ask = asStringArray(raw.questions_to_ask);
  if (!questions_to_ask) return { ok: false, error: "questions_to_ask" };

  const risks_and_ambiguities = asStringArray(raw.risks_and_ambiguities);
  if (!risks_and_ambiguities) return { ok: false, error: "risks_and_ambiguities" };

  if (!OPERATIONAL_COMPLEXITY.includes(raw.operational_complexity)) {
    return { ok: false, error: "operational_complexity" };
  }

  const complexity_rationale = asNonEmptyString(raw.complexity_rationale, 2000);
  if (!complexity_rationale) return { ok: false, error: "complexity_rationale" };

  const cc = raw.customer_context;
  if (!cc || typeof cc !== "object" || Array.isArray(cc)) {
    return { ok: false, error: "customer_context" };
  }
  if (!CUSTOMER_RECURRENCE.includes(cc.recurrence)) {
    return { ok: false, error: "customer_context.recurrence" };
  }
  const relevant_facts = asStringArray(cc.relevant_facts);
  const owner_tags = asStringArray(cc.owner_tags, { maxItems: 12, maxLen: 80 });
  if (!relevant_facts || !owner_tags) {
    return { ok: false, error: "customer_context.lists" };
  }

  const uncertainties = asStringArray(raw.uncertainties);
  if (!uncertainties) return { ok: false, error: "uncertainties" };

  const suggested_next_action = asNonEmptyString(raw.suggested_next_action, 500);
  if (!suggested_next_action) return { ok: false, error: "suggested_next_action" };

  const analysis = {
    factual_summary,
    missing_information,
    questions_to_ask,
    risks_and_ambiguities,
    operational_complexity: raw.operational_complexity,
    complexity_rationale,
    customer_context: {
      recurrence: cc.recurrence,
      relevant_facts,
      owner_tags,
    },
    uncertainties,
    suggested_next_action,
  };

  const coherence = checkLeadAnalysisCoherence(analysis);
  if (!coherence.ok) {
    return { ok: false, error: coherence.error };
  }

  return {
    ok: true,
    analysis,
  };
}
