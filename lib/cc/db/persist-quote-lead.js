import { getSql } from "./client.js";
import { QUOTE_BLOB_PREFIX } from "../../quote-limits.js";

/**
 * Persist a validated website quote into leads + lead_photos.
 * Throws on DB errors — callers that must not break the public quote flow
 * should use safePersistQuoteLead() instead.
 */
export async function persistQuoteLead(data) {
  const sql = getSql();
  if (!sql) {
    console.error("[cc/db] DATABASE_URL not configured; skipping lead persistence");
    return { skipped: true, reason: "missing_database_url" };
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid lead payload.");
  }

  const photos = Array.isArray(data.photos) ? data.photos : [];
  for (const photo of photos) {
    const pathname = photo?.pathname;
    if (
      typeof pathname !== "string" ||
      !pathname.startsWith(QUOTE_BLOB_PREFIX) ||
      pathname.includes("..")
    ) {
      throw new Error("Invalid private photo pathname.");
    }
  }

  const preferredDate =
    typeof data.preferredDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.preferredDate)
      ? data.preferredDate
      : null;

  const [lead] = await sql`
    INSERT INTO leads (
      status,
      full_name,
      email,
      city,
      property_type,
      project_type,
      description,
      contact_method,
      preferred_date,
      source
    )
    VALUES (
      'new',
      ${data.fullName},
      ${data.email},
      ${data.city},
      ${data.propertyType},
      ${data.projectType},
      ${data.description},
      ${data.contactMethod},
      ${preferredDate},
      'website_quote'
    )
    RETURNING id
  `;

  if (!lead?.id) {
    throw new Error("Lead insert did not return an id.");
  }

  for (const photo of photos) {
    await sql`
      INSERT INTO lead_photos (lead_id, blob_pathname, content_type, size_bytes)
      VALUES (
        ${lead.id},
        ${photo.pathname},
        ${photo.contentType || null},
        ${Number.isFinite(photo.size) ? photo.size : null}
      )
    `;
  }

  return { ok: true, leadId: lead.id, photoCount: photos.length };
}

/**
 * Never throws. Safe to call from the public quote route / after().
 */
export async function safePersistQuoteLead(data) {
  try {
    return await persistQuoteLead(data);
  } catch (error) {
    console.error("[cc/db] lead persistence failed");
    return { ok: false, error: "persistence_failed" };
  }
}
