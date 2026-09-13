import { getSql } from "./client.js";
import {
  isValidPlaybookCategory,
  isValidPlaybookRevisionStatus,
  isValidPlaybookSensitivity,
  isValidPlaybookValidationState,
  normalizePlaybookSlug,
  normalizePlaybookStringList,
} from "../domain/playbook.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Create a stable Playbook entry identity (no revision content yet).
 * Does not seed MCS business rules. Does not touch CRM / AI tables.
 */
export async function createPlaybookEntry({
  slug,
  category,
  title,
  serviceKeys = [],
  tags = [],
  sensitivity,
  validationState,
  createdBy = "owner",
}) {
  const sql = requireSql();

  const normalizedSlug = normalizePlaybookSlug(slug);
  if (!normalizedSlug) return { ok: false, error: "invalid_slug" };
  if (!isValidPlaybookCategory(category)) return { ok: false, error: "invalid_category" };
  if (!isValidPlaybookSensitivity(sensitivity)) return { ok: false, error: "invalid_sensitivity" };
  if (!isValidPlaybookValidationState(validationState)) {
    return { ok: false, error: "invalid_validation_state" };
  }

  const titleText = typeof title === "string" ? title.trim().slice(0, 200) : "";
  if (titleText.length < 1) return { ok: false, error: "invalid_title" };

  const keys = normalizePlaybookStringList(serviceKeys);
  const tagList = normalizePlaybookStringList(tags);
  const actor = typeof createdBy === "string" && createdBy.trim() ? createdBy.trim().slice(0, 80) : "owner";

  try {
    const rows = await sql`
      INSERT INTO playbook_entries (
        slug, category, title, service_keys, tags, sensitivity, validation_state, created_by
      )
      VALUES (
        ${normalizedSlug},
        ${category},
        ${titleText},
        ${keys},
        ${tagList},
        ${sensitivity},
        ${validationState},
        ${actor}
      )
      RETURNING
        id, slug, category, title, service_keys, tags, sensitivity, validation_state,
        current_approved_revision_id, created_at, updated_at, created_by
    `;
    const entry = rows[0];
    if (!entry) return { ok: false, error: "insert_failed" };
    return { ok: true, entry };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(msg)) {
      return { ok: false, error: "slug_taken" };
    }
    console.error("[cc/playbook] createPlaybookEntry failed");
    return { ok: false, error: "insert_failed" };
  }
}

export async function getPlaybookEntryById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, slug, category, title, service_keys, tags, sensitivity, validation_state,
      current_approved_revision_id, created_at, updated_at, created_by
    FROM playbook_entries
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getPlaybookEntryBySlug(slug) {
  const sql = requireSql();
  const normalizedSlug = normalizePlaybookSlug(slug);
  if (!normalizedSlug) return null;
  const rows = await sql`
    SELECT
      id, slug, category, title, service_keys, tags, sensitivity, validation_state,
      current_approved_revision_id, created_at, updated_at, created_by
    FROM playbook_entries
    WHERE slug = ${normalizedSlug}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Append a new draft revision for an entry. Never silently edits an approved revision.
 * Version = max(existing)+1. Status forced to draft.
 */
export async function createPlaybookDraftRevision({
  entryId,
  summary = null,
  bodyMd = "",
  structuredFields = null,
  changeNote = null,
  supersedesRevisionId = null,
  createdBy = "owner",
}) {
  const sql = requireSql();

  if (typeof entryId !== "string" || entryId.trim().length < 1) {
    return { ok: false, error: "invalid_entry_id" };
  }

  const entry = await getPlaybookEntryById(entryId);
  if (!entry) return { ok: false, error: "entry_not_found" };

  const body = typeof bodyMd === "string" ? bodyMd.slice(0, 100_000) : "";
  const summaryText =
    typeof summary === "string" && summary.trim().length > 0
      ? summary.trim().slice(0, 2000)
      : null;
  const note =
    typeof changeNote === "string" && changeNote.trim().length > 0
      ? changeNote.trim().slice(0, 2000)
      : null;
  const actor = typeof createdBy === "string" && createdBy.trim() ? createdBy.trim().slice(0, 80) : "owner";

  let structured = null;
  if (structuredFields != null) {
    if (typeof structuredFields !== "object" || Array.isArray(structuredFields)) {
      return { ok: false, error: "invalid_structured_fields" };
    }
    structured = structuredFields;
  }

  if (supersedesRevisionId != null) {
    if (typeof supersedesRevisionId !== "string") {
      return { ok: false, error: "invalid_supersedes" };
    }
    const prev = await getPlaybookRevisionById(supersedesRevisionId);
    if (!prev || prev.entry_id !== entryId) {
      return { ok: false, error: "invalid_supersedes" };
    }
  }

  const versionRows = await sql`
    SELECT COALESCE(MAX(version), 0)::int AS max_version
    FROM playbook_revisions
    WHERE entry_id = ${entryId}
  `;
  const nextVersion = (versionRows[0]?.max_version || 0) + 1;

  try {
    const rows = await sql`
      INSERT INTO playbook_revisions (
        entry_id,
        version,
        status,
        summary,
        body_md,
        structured_fields,
        change_note,
        supersedes_revision_id,
        created_by
      )
      VALUES (
        ${entryId},
        ${nextVersion},
        'draft',
        ${summaryText},
        ${body},
        ${structured ? JSON.stringify(structured) : null}::jsonb,
        ${note},
        ${supersedesRevisionId},
        ${actor}
      )
      RETURNING
        id, entry_id, version, status, summary, body_md, structured_fields,
        change_note, supersedes_revision_id, approved_at, approved_by, retired_at,
        created_at, created_by
    `;
    const revision = rows[0];
    if (!revision) return { ok: false, error: "insert_failed" };

    await sql`
      UPDATE playbook_entries
      SET updated_at = now()
      WHERE id = ${entryId}
    `;

    return { ok: true, revision };
  } catch (error) {
    console.error("[cc/playbook] createPlaybookDraftRevision failed");
    return { ok: false, error: "insert_failed" };
  }
}

/**
 * Create entry + initial draft revision in one foundation helper (UI / tests).
 */
export async function createPlaybookEntryWithDraft(input) {
  const entryResult = await createPlaybookEntry({
    slug: input.slug,
    category: input.category,
    title: input.title,
    serviceKeys: input.serviceKeys,
    tags: input.tags,
    sensitivity: input.sensitivity,
    validationState: input.validationState,
    createdBy: input.createdBy,
  });
  if (!entryResult.ok) return entryResult;

  const draftResult = await createPlaybookDraftRevision({
    entryId: entryResult.entry.id,
    summary: input.summary,
    bodyMd: input.bodyMd,
    changeNote: input.changeNote,
    createdBy: input.createdBy,
  });
  if (!draftResult.ok) {
    return {
      ok: false,
      error: draftResult.error || "draft_insert_failed",
      entry: entryResult.entry,
    };
  }

  return {
    ok: true,
    entry: entryResult.entry,
    revision: draftResult.revision,
  };
}

export async function getPlaybookRevisionById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, entry_id, version, status, summary, body_md, structured_fields,
      change_note, supersedes_revision_id, approved_at, approved_by, retired_at,
      created_at, created_by
    FROM playbook_revisions
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function listPlaybookRevisionsForEntry(entryId) {
  const sql = requireSql();
  return sql`
    SELECT
      id, entry_id, version, status, summary, body_md, structured_fields,
      change_note, supersedes_revision_id, approved_at, approved_by, retired_at,
      created_at, created_by
    FROM playbook_revisions
    WHERE entry_id = ${entryId}
    ORDER BY version DESC
  `;
}

/**
 * @param {{
 *   q?: string,
 *   category?: string,
 *   serviceKey?: string,
 *   validationState?: string,
 *   sensitivity?: string,
 *   revisionStatus?: string,
 *   limit?: number,
 *   offset?: number,
 * }} filters
 */
export async function listPlaybookEntries(filters = {}) {
  const sql = requireSql();
  const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 120) : "";
  const category =
    typeof filters.category === "string" && isValidPlaybookCategory(filters.category)
      ? filters.category
      : null;
  const validationState =
    typeof filters.validationState === "string" &&
    isValidPlaybookValidationState(filters.validationState)
      ? filters.validationState
      : null;
  const sensitivity =
    typeof filters.sensitivity === "string" && isValidPlaybookSensitivity(filters.sensitivity)
      ? filters.sensitivity
      : null;
  const serviceKey =
    typeof filters.serviceKey === "string" && filters.serviceKey.trim().length > 0
      ? filters.serviceKey.trim().slice(0, 80)
      : null;
  const revisionStatus =
    typeof filters.revisionStatus === "string" &&
    isValidPlaybookRevisionStatus(filters.revisionStatus)
      ? filters.revisionStatus
      : null;
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const pattern = q ? `%${q}%` : null;

  // Neon tagged templates — explicit branches for safety.
  return sql`
    SELECT
      e.id,
      e.slug,
      e.category,
      e.title,
      e.service_keys,
      e.tags,
      e.sensitivity,
      e.validation_state,
      e.current_approved_revision_id,
      e.created_at,
      e.updated_at,
      e.created_by,
      lr.id AS latest_revision_id,
      lr.version AS latest_version,
      lr.status AS latest_status,
      lr.summary AS latest_summary,
      (
        SELECT r.status
        FROM playbook_revisions r
        WHERE r.entry_id = e.id AND r.status = 'approved'
        ORDER BY r.version DESC
        LIMIT 1
      ) AS approved_status
    FROM playbook_entries e
    LEFT JOIN LATERAL (
      SELECT id, version, status, summary
      FROM playbook_revisions
      WHERE entry_id = e.id
      ORDER BY version DESC
      LIMIT 1
    ) lr ON true
    WHERE
      (${category}::text IS NULL OR e.category = ${category})
      AND (${validationState}::text IS NULL OR e.validation_state = ${validationState})
      AND (${sensitivity}::text IS NULL OR e.sensitivity = ${sensitivity})
      AND (
        ${serviceKey}::text IS NULL
        OR ${serviceKey}::text = ANY (e.service_keys)
        OR '*' = ANY (e.service_keys)
      )
      AND (
        ${revisionStatus}::text IS NULL
        OR lr.status = ${revisionStatus}
        OR (
          ${revisionStatus}::text = 'approved'
          AND e.current_approved_revision_id IS NOT NULL
        )
      )
      AND (
        ${pattern}::text IS NULL
        OR e.title ILIKE ${pattern}
        OR e.slug ILIKE ${pattern}
        OR COALESCE(lr.summary, '') ILIKE ${pattern}
      )
    ORDER BY e.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Update entry identity/metadata only. Never mutates revision bodies.
 */
export async function updatePlaybookEntryMetadata({
  entryId,
  title,
  category,
  serviceKeys,
  tags,
  sensitivity,
  validationState,
}) {
  const sql = requireSql();
  const entry = await getPlaybookEntryById(entryId);
  if (!entry) return { ok: false, error: "entry_not_found" };

  if (!isValidPlaybookCategory(category)) return { ok: false, error: "invalid_category" };
  if (!isValidPlaybookSensitivity(sensitivity)) return { ok: false, error: "invalid_sensitivity" };
  if (!isValidPlaybookValidationState(validationState)) {
    return { ok: false, error: "invalid_validation_state" };
  }
  const titleText = typeof title === "string" ? title.trim().slice(0, 200) : "";
  if (titleText.length < 1) return { ok: false, error: "invalid_title" };

  const keys = normalizePlaybookStringList(serviceKeys);
  const tagList = normalizePlaybookStringList(tags);

  const rows = await sql`
    UPDATE playbook_entries
    SET
      title = ${titleText},
      category = ${category},
      service_keys = ${keys},
      tags = ${tagList},
      sensitivity = ${sensitivity},
      validation_state = ${validationState},
      updated_at = now()
    WHERE id = ${entryId}
    RETURNING
      id, slug, category, title, service_keys, tags, sensitivity, validation_state,
      current_approved_revision_id, created_at, updated_at, created_by
  `;
  const updated = rows[0];
  if (!updated) return { ok: false, error: "update_failed" };
  return { ok: true, entry: updated };
}

/**
 * Update an existing draft revision in place.
 * Approved / retired revisions are rejected (immutability).
 */
export async function updatePlaybookDraftRevision({
  revisionId,
  summary = null,
  bodyMd = "",
  changeNote = null,
}) {
  const sql = requireSql();
  const revision = await getPlaybookRevisionById(revisionId);
  if (!revision) return { ok: false, error: "not_found" };
  if (revision.status !== "draft") {
    return { ok: false, error: "not_draft", status: revision.status };
  }

  const body = typeof bodyMd === "string" ? bodyMd.slice(0, 100_000) : "";
  const summaryText =
    typeof summary === "string" && summary.trim().length > 0
      ? summary.trim().slice(0, 2000)
      : null;
  const note =
    typeof changeNote === "string" && changeNote.trim().length > 0
      ? changeNote.trim().slice(0, 2000)
      : null;

  const rows = await sql`
    UPDATE playbook_revisions
    SET
      summary = ${summaryText},
      body_md = ${body},
      change_note = ${note}
    WHERE id = ${revisionId}
      AND status = 'draft'
    RETURNING
      id, entry_id, version, status, summary, body_md, structured_fields,
      change_note, supersedes_revision_id, approved_at, approved_by, retired_at,
      created_at, created_by
  `;
  const updated = rows[0];
  if (!updated) return { ok: false, error: "update_failed" };

  await sql`
    UPDATE playbook_entries
    SET updated_at = now()
    WHERE id = ${updated.entry_id}
  `;

  return { ok: true, revision: updated };
}

/**
 * Domain guard used by tests — 4A.5.a/b has no approve workflow yet.
 * Callers must not treat this as an implemented mutation API for production UI.
 */
export function assertRevisionStatusTransitionAllowed(from, to) {
  if (!isValidPlaybookRevisionStatus(from) || !isValidPlaybookRevisionStatus(to)) {
    return false;
  }
  if (from === to) return false;
  // Approved content is immutable in place: only draft→approved / approved→retired later.
  if (from === "approved" && to === "draft") return false;
  if (from === "retired") return false;
  return true;
}
