import { getSql } from "../../db/client.js";
import {
  LEAD_AGENT_PLAYBOOK_BODY_MAX,
  LEAD_AGENT_PLAYBOOK_CATEGORIES,
  LEAD_AGENT_PLAYBOOK_MAX_ENTRIES,
  LEAD_AGENT_PLAYBOOK_SUMMARY_MAX,
  PLAYBOOK_ALL_SERVICES_KEY,
} from "../../domain/playbook.js";
import { SERVICES } from "../../../site-config.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

function clip(text, max) {
  if (typeof text !== "string") return "";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncated]`;
}

/**
 * Deterministic service_keys match for a lead.
 * Matches '*' / all-services, or service id/name against lead.project_type.
 */
export function playbookServiceKeysMatchLead(serviceKeys, lead) {
  const keys = Array.isArray(serviceKeys) ? serviceKeys : [];
  if (keys.length === 0 || keys.includes(PLAYBOOK_ALL_SERVICES_KEY)) {
    return true;
  }

  const projectType =
    typeof lead?.project_type === "string" ? lead.project_type.trim().toLowerCase() : "";
  if (!projectType) return false;

  for (const key of keys) {
    if (typeof key !== "string" || !key.trim()) continue;
    const k = key.trim().toLowerCase();
    if (projectType === k || projectType.includes(k)) return true;
    const service = SERVICES.find((s) => s.id === key);
    if (service) {
      const name = service.name.toLowerCase();
      if (projectType === name || projectType.includes(name) || name.includes(projectType)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Retrieve approved + validated Playbook guidance for Lead Agent.
 * Deterministic filters only — no embeddings / semantic search.
 *
 * @param {object} lead
 * @returns {Promise<{ entries: object[], revisionIds: string[], text: string }>}
 */
export async function retrieveApprovedPlaybookForLead(lead) {
  if (!lead || typeof lead !== "object" || !lead.id) {
    return { entries: [], revisionIds: [], text: "" };
  }

  const sql = requireSql();
  const categories = [...LEAD_AGENT_PLAYBOOK_CATEGORIES];

  const rows = await sql`
    SELECT
      e.id AS entry_id,
      e.slug,
      e.category,
      e.title,
      e.service_keys,
      e.sensitivity,
      e.validation_state,
      r.id AS revision_id,
      r.version,
      r.summary,
      r.body_md,
      r.status AS revision_status
    FROM playbook_entries e
    INNER JOIN playbook_revisions r
      ON r.id = e.current_approved_revision_id
    WHERE e.validation_state = 'validated'
      AND e.current_approved_revision_id IS NOT NULL
      AND r.status = 'approved'
      AND e.sensitivity <> 'internal_employee'
      AND e.category = ANY(${categories})
    ORDER BY e.category ASC, e.title ASC, r.id ASC
  `;

  const matched = [];
  for (const row of rows) {
    if (!playbookServiceKeysMatchLead(row.service_keys, lead)) continue;
    matched.push(row);
    if (matched.length >= LEAD_AGENT_PLAYBOOK_MAX_ENTRIES) break;
  }

  const revisionIds = matched.map((m) => String(m.revision_id)).sort();

  const blocks = matched.map((m, i) => {
    const summary = clip(m.summary || "", LEAD_AGENT_PLAYBOOK_SUMMARY_MAX);
    const body = clip(m.body_md || "", LEAD_AGENT_PLAYBOOK_BODY_MAX);
    return [
      `[${i + 1}] ${m.title}`,
      `Category: ${m.category}`,
      `Revision: ${m.revision_id} (v${m.version})`,
      summary ? `Summary: ${summary}` : null,
      "Guidance:",
      body || "(empty)",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const text = blocks.length
    ? blocks.join("\n\n---\n\n")
    : "(No approved Playbook guidance matched this lead.)";

  return {
    entries: matched,
    revisionIds,
    text,
  };
}
