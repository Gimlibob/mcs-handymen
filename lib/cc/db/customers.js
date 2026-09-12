import { getSql } from "./client.js";
import { normalizeCustomerEmail } from "../domain/customer-match.js";
import { isValidCustomerTag } from "../domain/customer-tags.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Find active (non-merged) customer by normalized email.
 */
export async function findCustomerByEmailNormalized(emailNormalized) {
  const sql = requireSql();
  const key = normalizeCustomerEmail(emailNormalized);
  if (!key) return null;
  const rows = await sql`
    SELECT id, full_name, email, email_normalized, city, merged_into_customer_id,
           created_at, updated_at
    FROM customers
    WHERE email_normalized = ${key}
      AND merged_into_customer_id IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Resolve or create customer for a new lead. Never matches on name.
 * Updates customer display fields only — never rewrites historical lead rows.
 */
export async function resolveOrCreateCustomer({ fullName, email, city }) {
  const sql = requireSql();
  const emailNormalized = normalizeCustomerEmail(email);
  if (!emailNormalized) {
    throw new Error("Customer email is required.");
  }

  const name =
    typeof fullName === "string" && fullName.trim().length > 0
      ? fullName.trim().slice(0, 120)
      : "Unknown";
  const cityValue =
    typeof city === "string" && city.trim().length > 0 ? city.trim().slice(0, 80) : null;
  const emailDisplay =
    typeof email === "string" && email.trim().length > 0
      ? email.trim().slice(0, 200)
      : emailNormalized;

  const existing = await findCustomerByEmailNormalized(emailNormalized);
  if (existing) {
    await sql`
      UPDATE customers
      SET
        full_name = ${name},
        email = ${emailDisplay},
        city = COALESCE(${cityValue}, city),
        updated_at = now()
      WHERE id = ${existing.id}
    `;
    return { customerId: existing.id, created: false };
  }

  const rows = await sql`
    INSERT INTO customers (full_name, email, email_normalized, city)
    VALUES (${name}, ${emailDisplay}, ${emailNormalized}, ${cityValue})
    RETURNING id
  `;
  const created = rows[0];
  if (!created?.id) {
    throw new Error("Customer insert did not return an id.");
  }
  return { customerId: created.id, created: true };
}

/**
 * @param {{ q?: string, limit?: number, offset?: number }} filters
 */
export async function listCustomers(filters = {}) {
  const sql = requireSql();
  const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 120) : "";
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  if (q) {
    const pattern = `%${q}%`;
    return sql`
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.city,
        c.created_at,
        c.updated_at,
        COUNT(l.id)::int AS lead_count,
        MAX(l.created_at) AS last_lead_at
      FROM customers c
      LEFT JOIN leads l ON l.customer_id = c.id
      WHERE c.merged_into_customer_id IS NULL
        AND (
          c.full_name ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
          OR c.city ILIKE ${pattern}
        )
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return sql`
    SELECT
      c.id,
      c.full_name,
      c.email,
      c.city,
      c.created_at,
      c.updated_at,
      COUNT(l.id)::int AS lead_count,
      MAX(l.created_at) AS last_lead_at
    FROM customers c
    LEFT JOIN leads l ON l.customer_id = c.id
    WHERE c.merged_into_customer_id IS NULL
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getCustomerById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT id, full_name, email, email_normalized, city, merged_into_customer_id,
           created_at, updated_at
    FROM customers
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getCustomerLeadCount(customerId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM leads
    WHERE customer_id = ${customerId}
  `;
  return rows[0]?.count ?? 0;
}

export async function listCustomerLeads(customerId) {
  const sql = requireSql();
  return sql`
    SELECT
      id, full_name, email, city, project_type, status, source,
      created_at, updated_at
    FROM leads
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}

export async function getCustomerServices(customerId) {
  const sql = requireSql();
  return sql`
    SELECT DISTINCT project_type
    FROM leads
    WHERE customer_id = ${customerId}
    ORDER BY project_type ASC
  `;
}

export async function getCustomerLastActivity(customerId) {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      GREATEST(
        (SELECT MAX(updated_at) FROM leads WHERE customer_id = ${customerId}),
        (SELECT MAX(created_at) FROM customer_notes WHERE customer_id = ${customerId}),
        (SELECT MAX(a.created_at)
         FROM activity_log a
         INNER JOIN leads l ON l.id = a.lead_id
         WHERE l.customer_id = ${customerId})
      ) AS last_activity_at
  `;
  return rows[0]?.last_activity_at || null;
}

export async function getCustomerTimeline(customerId) {
  const sql = requireSql();
  return sql`
    (
      SELECT
        a.created_at,
        a.event_type,
        a.message,
        'lead_activity'::text AS kind,
        a.lead_id::text AS ref_id,
        l.project_type AS context
      FROM activity_log a
      INNER JOIN leads l ON l.id = a.lead_id
      WHERE l.customer_id = ${customerId}
    )
    UNION ALL
    (
      SELECT
        n.created_at,
        'customer_note'::text AS event_type,
        n.body AS message,
        'customer_note'::text AS kind,
        n.id::text AS ref_id,
        NULL::text AS context
      FROM customer_notes n
      WHERE n.customer_id = ${customerId}
    )
    UNION ALL
    (
      SELECT
        t.created_at,
        'customer_tag'::text AS event_type,
        t.tag_key AS message,
        'customer_tag'::text AS kind,
        t.id::text AS ref_id,
        NULL::text AS context
      FROM customer_tag_assignments t
      WHERE t.customer_id = ${customerId}
    )
    ORDER BY created_at DESC
    LIMIT 150
  `;
}

export async function getCustomerNotes(customerId) {
  const sql = requireSql();
  return sql`
    SELECT id, customer_id, body, created_at, created_by
    FROM customer_notes
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}

export async function addCustomerNote({ customerId, body, actor = "owner" }) {
  const sql = requireSql();
  const text = typeof body === "string" ? body.trim().slice(0, 5000) : "";
  if (text.length < 1) return { ok: false, error: "empty_note" };

  const customer = await getCustomerById(customerId);
  if (!customer || customer.merged_into_customer_id) {
    return { ok: false, error: "not_found" };
  }

  const rows = await sql`
    INSERT INTO customer_notes (customer_id, body, created_by)
    VALUES (${customerId}, ${text}, ${actor})
    RETURNING id, customer_id, body, created_at, created_by
  `;
  const note = rows[0];
  if (!note) return { ok: false, error: "insert_failed" };

  await sql`UPDATE customers SET updated_at = now() WHERE id = ${customerId}`;
  return { ok: true, note };
}

export async function getCustomerTags(customerId) {
  const sql = requireSql();
  return sql`
    SELECT id, customer_id, tag_key, created_at, created_by
    FROM customer_tag_assignments
    WHERE customer_id = ${customerId}
    ORDER BY tag_key ASC
  `;
}

export async function setCustomerTags({ customerId, tagKeys, actor = "owner" }) {
  const sql = requireSql();
  const customer = await getCustomerById(customerId);
  if (!customer || customer.merged_into_customer_id) {
    return { ok: false, error: "not_found" };
  }

  const wanted = Array.isArray(tagKeys)
    ? [...new Set(tagKeys.filter((k) => isValidCustomerTag(k)))]
    : [];

  const existing = await getCustomerTags(customerId);
  const existingKeys = new Set(existing.map((t) => t.tag_key));
  const wantedSet = new Set(wanted);

  for (const row of existing) {
    if (!wantedSet.has(row.tag_key)) {
      await sql`
        DELETE FROM customer_tag_assignments
        WHERE customer_id = ${customerId} AND tag_key = ${row.tag_key}
      `;
    }
  }

  for (const key of wanted) {
    if (!existingKeys.has(key)) {
      await sql`
        INSERT INTO customer_tag_assignments (customer_id, tag_key, created_by)
        VALUES (${customerId}, ${key}, ${actor})
        ON CONFLICT (customer_id, tag_key) DO NOTHING
      `;
    }
  }

  await sql`UPDATE customers SET updated_at = now() WHERE id = ${customerId}`;
  return { ok: true, tagKeys: wanted };
}

export async function countOrphanLeads() {
  const sql = requireSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM leads
    WHERE customer_id IS NULL
  `;
  return rows[0]?.count ?? 0;
}

/**
 * Lightweight summary for Lead Detail badge.
 */
export async function getCustomerSummaryForLead(customerId) {
  if (!customerId) return null;
  const sql = requireSql();
  const rows = await sql`
    SELECT
      c.id,
      c.full_name,
      COUNT(l.id)::int AS lead_count
    FROM customers c
    LEFT JOIN leads l ON l.customer_id = c.id
    WHERE c.id = ${customerId}
      AND c.merged_into_customer_id IS NULL
    GROUP BY c.id
    LIMIT 1
  `;
  return rows[0] || null;
}
