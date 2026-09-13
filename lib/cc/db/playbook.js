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
 * Domain guard for allowed revision status transitions.
 * Production approve/retire use dedicated transactional helpers.
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

/**
 * Promote a draft revision to approved (entry must be validation_state = validated).
 * Retires any prior approved revision for the entry. Atomic.
 * Mutating statements are gated in SQL so a non-validated entry cannot partially apply.
 */
export async function approvePlaybookRevision({
  entryId,
  revisionId,
  approvedBy = "owner",
}) {
  const sql = requireSql();

  if (typeof entryId !== "string" || entryId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof revisionId !== "string" || revisionId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  const actor =
    typeof approvedBy === "string" && approvedBy.trim()
      ? approvedBy.trim().slice(0, 80)
      : "owner";

  let results;
  try {
    results = await sql.transaction((txn) => [
      txn`
        SELECT
          id, validation_state, current_approved_revision_id
        FROM playbook_entries
        WHERE id = ${entryId}
        FOR UPDATE
      `,
      txn`
        SELECT id, entry_id, status, version
        FROM playbook_revisions
        WHERE id = ${revisionId}
        FOR UPDATE
      `,
      // Retire prior approved only when entry is validated and target is an eligible draft.
      txn`
        UPDATE playbook_revisions
        SET
          status = 'retired',
          retired_at = now()
        WHERE entry_id = ${entryId}
          AND status = 'approved'
          AND id <> ${revisionId}
          AND EXISTS (
            SELECT 1 FROM playbook_entries e
            WHERE e.id = ${entryId}
              AND e.validation_state = 'validated'
          )
          AND EXISTS (
            SELECT 1 FROM playbook_revisions r
            WHERE r.id = ${revisionId}
              AND r.entry_id = ${entryId}
              AND r.status = 'draft'
          )
        RETURNING id
      `,
      txn`
        UPDATE playbook_revisions AS r
        SET
          status = 'approved',
          approved_at = now(),
          approved_by = ${actor},
          retired_at = NULL
        FROM playbook_entries AS e
        WHERE r.id = ${revisionId}
          AND r.entry_id = ${entryId}
          AND r.status = 'draft'
          AND e.id = r.entry_id
          AND e.validation_state = 'validated'
        RETURNING
          r.id, r.entry_id, r.version, r.status, r.summary, r.body_md, r.structured_fields,
          r.change_note, r.supersedes_revision_id, r.approved_at, r.approved_by, r.retired_at,
          r.created_at, r.created_by
      `,
      txn`
        UPDATE playbook_entries
        SET
          current_approved_revision_id = ${revisionId},
          updated_at = now()
        WHERE id = ${entryId}
          AND validation_state = 'validated'
          AND EXISTS (
            SELECT 1 FROM playbook_revisions r
            WHERE r.id = ${revisionId}
              AND r.entry_id = ${entryId}
              AND r.status = 'approved'
          )
        RETURNING
          id, slug, category, title, service_keys, tags, sensitivity, validation_state,
          current_approved_revision_id, created_at, updated_at, created_by
      `,
    ]);
  } catch (error) {
    console.error("[cc/playbook] approve failed", error?.message || error);
    return { ok: false, error: "persist_failed" };
  }

  const entryRows = results?.[0];
  const entry = Array.isArray(entryRows) ? entryRows[0] : entryRows;
  if (!entry?.id) return { ok: false, error: "entry_not_found" };

  const revRows = results?.[1];
  const rev = Array.isArray(revRows) ? revRows[0] : revRows;
  if (!rev?.id) return { ok: false, error: "revision_not_found" };
  if (String(rev.entry_id) !== String(entryId)) {
    return { ok: false, error: "revision_entry_mismatch" };
  }

  if (entry.validation_state !== "validated") {
    return { ok: false, error: "entry_not_validated" };
  }
  if (rev.status !== "draft") {
    return { ok: false, error: "revision_not_draft" };
  }

  const approvedRows = results?.[3];
  const approved = Array.isArray(approvedRows) ? approvedRows[0] : approvedRows;
  if (!approved?.id) return { ok: false, error: "approve_failed" };

  const entryAfter = Array.isArray(results?.[4]) ? results[4][0] : results?.[4];
  if (!entryAfter?.id) return { ok: false, error: "approve_failed" };

  return { ok: true, entry: entryAfter, revision: approved };
}

/**
 * Retire an approved revision and clear current_approved_revision_id when it pointed here.
 * Atomic. Does not delete history.
 */
export async function retirePlaybookRevision({
  entryId,
  revisionId,
}) {
  const sql = requireSql();

  if (typeof entryId !== "string" || entryId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof revisionId !== "string" || revisionId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }

  let results;
  try {
    results = await sql.transaction((txn) => [
      txn`
        SELECT id, current_approved_revision_id
        FROM playbook_entries
        WHERE id = ${entryId}
        FOR UPDATE
      `,
      txn`
        SELECT id, entry_id, status
        FROM playbook_revisions
        WHERE id = ${revisionId}
        FOR UPDATE
      `,
      txn`
        UPDATE playbook_revisions
        SET
          status = 'retired',
          retired_at = now()
        WHERE id = ${revisionId}
          AND entry_id = ${entryId}
          AND status = 'approved'
        RETURNING
          id, entry_id, version, status, summary, body_md, structured_fields,
          change_note, supersedes_revision_id, approved_at, approved_by, retired_at,
          created_at, created_by
      `,
      txn`
        UPDATE playbook_entries
        SET
          current_approved_revision_id = CASE
            WHEN current_approved_revision_id = ${revisionId} THEN NULL
            ELSE current_approved_revision_id
          END,
          updated_at = now()
        WHERE id = ${entryId}
        RETURNING
          id, slug, category, title, service_keys, tags, sensitivity, validation_state,
          current_approved_revision_id, created_at, updated_at, created_by
      `,
    ]);
  } catch (error) {
    console.error("[cc/playbook] retire failed", error?.message || error);
    return { ok: false, error: "persist_failed" };
  }

  const entryRows = results?.[0];
  const entry = Array.isArray(entryRows) ? entryRows[0] : entryRows;
  if (!entry?.id) return { ok: false, error: "entry_not_found" };

  const revRows = results?.[1];
  const rev = Array.isArray(revRows) ? revRows[0] : revRows;
  if (!rev?.id) return { ok: false, error: "revision_not_found" };
  if (String(rev.entry_id) !== String(entryId)) {
    return { ok: false, error: "revision_entry_mismatch" };
  }
  if (rev.status !== "approved") {
    return { ok: false, error: "revision_not_approved" };
  }

  const retiredRows = results?.[2];
  const retired = Array.isArray(retiredRows) ? retiredRows[0] : retiredRows;
  if (!retired?.id) return { ok: false, error: "retire_failed" };

  const entryAfter = Array.isArray(results?.[3]) ? results[3][0] : results?.[3];
  if (!entryAfter?.id) return { ok: false, error: "retire_failed" };

  return { ok: true, entry: entryAfter, revision: retired };
}
