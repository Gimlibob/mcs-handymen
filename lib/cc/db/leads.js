import { getSql } from "./client.js";
import {
  canTransitionLeadStatus,
  isValidLeadStatus,
  statusLabel,
} from "../domain/lead-status.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

export async function getLeadStatusCounts() {
  const sql = requireSql();
  const rows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM leads
    GROUP BY status
  `;
  const counts = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

export async function listLeadsForAttention() {
  const sql = requireSql();
  return sql`
    SELECT id, full_name, city, status, created_at, updated_at
    FROM leads
    WHERE status NOT IN ('closed_won', 'closed_lost')
    ORDER BY updated_at ASC
    LIMIT 200
  `;
}

/**
 * @param {{ q?: string, status?: string, limit?: number, offset?: number }} filters
 */
export async function listLeads(filters = {}) {
  const sql = requireSql();
  const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 120) : "";
  const status =
    typeof filters.status === "string" && isValidLeadStatus(filters.status)
      ? filters.status
      : null;
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  // Neon tagged templates — branch query shapes explicitly for safety.
  if (status && q) {
    const pattern = `%${q}%`;
    return sql`
      SELECT id, full_name, email, city, project_type, contact_method, status, source, created_at, updated_at
      FROM leads
      WHERE status = ${status}
        AND (
          full_name ILIKE ${pattern}
          OR email ILIKE ${pattern}
          OR city ILIKE ${pattern}
          OR project_type ILIKE ${pattern}
        )
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (status) {
    return sql`
      SELECT id, full_name, email, city, project_type, contact_method, status, source, created_at, updated_at
      FROM leads
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (q) {
    const pattern = `%${q}%`;
    return sql`
      SELECT id, full_name, email, city, project_type, contact_method, status, source, created_at, updated_at
      FROM leads
      WHERE full_name ILIKE ${pattern}
         OR email ILIKE ${pattern}
         OR city ILIKE ${pattern}
         OR project_type ILIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return sql`
    SELECT id, full_name, email, city, project_type, contact_method, status, source, created_at, updated_at
    FROM leads
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getLeadById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, customer_id, full_name, email, city, property_type, project_type, description,
      contact_method, preferred_date, status, source, created_at, updated_at
    FROM leads
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getLeadPhotos(leadId) {
  const sql = requireSql();
  return sql`
    SELECT id, lead_id, blob_pathname, content_type, size_bytes, created_at
    FROM lead_photos
    WHERE lead_id = ${leadId}
    ORDER BY created_at ASC
  `;
}

export async function getLeadPhotoById(photoId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT id, lead_id, blob_pathname, content_type, size_bytes
    FROM lead_photos
    WHERE id = ${photoId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getLeadNotes(leadId) {
  const sql = requireSql();
  return sql`
    SELECT id, lead_id, body, created_at, created_by
    FROM lead_notes
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC
  `;
}

export async function getLeadActivity(leadId) {
  const sql = requireSql();
  return sql`
    SELECT id, lead_id, event_type, message, meta, created_at, created_by
    FROM activity_log
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC
    LIMIT 100
  `;
}

export async function logLeadActivity({
  leadId,
  eventType,
  message,
  meta = null,
  createdBy = "system",
}) {
  const sql = requireSql();
  await sql`
    INSERT INTO activity_log (lead_id, event_type, message, meta, created_by)
    VALUES (
      ${leadId},
      ${eventType},
      ${message},
      ${meta ? JSON.stringify(meta) : null}::jsonb,
      ${createdBy}
    )
  `;
}

export async function updateLeadStatus({ leadId, nextStatus, actor = "owner" }) {
  const sql = requireSql();

  if (!isValidLeadStatus(nextStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const lead = await getLeadById(leadId);
  if (!lead) return { ok: false, error: "not_found" };

  if (!canTransitionLeadStatus(lead.status, nextStatus)) {
    return {
      ok: false,
      error: "invalid_transition",
      from: lead.status,
      to: nextStatus,
    };
  }

  const rows = await sql`
    UPDATE leads
    SET status = ${nextStatus}, updated_at = now()
    WHERE id = ${leadId}
    RETURNING id, status, updated_at
  `;

  const updated = rows[0];
  if (!updated) return { ok: false, error: "update_failed" };

  await logLeadActivity({
    leadId,
    eventType: "status_changed",
    message: `Status changed from ${statusLabel(lead.status)} to ${statusLabel(nextStatus)}`,
    meta: { from: lead.status, to: nextStatus },
    createdBy: actor,
  });

  return { ok: true, lead: updated };
}

export async function addLeadNote({ leadId, body, actor = "owner" }) {
  const sql = requireSql();
  const text = typeof body === "string" ? body.trim().slice(0, 5000) : "";
  if (text.length < 1) return { ok: false, error: "empty_note" };

  const lead = await getLeadById(leadId);
  if (!lead) return { ok: false, error: "not_found" };

  const rows = await sql`
    INSERT INTO lead_notes (lead_id, body, created_by)
    VALUES (${leadId}, ${text}, ${actor})
    RETURNING id, lead_id, body, created_at, created_by
  `;

  const note = rows[0];
  if (!note) return { ok: false, error: "insert_failed" };

  await sql`
    UPDATE leads SET updated_at = now() WHERE id = ${leadId}
  `;

  await logLeadActivity({
    leadId,
    eventType: "note_added",
    message: "Internal note added",
    meta: { noteId: note.id },
    createdBy: actor,
  });

  return { ok: true, note };
}
