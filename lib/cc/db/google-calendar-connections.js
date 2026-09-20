import { getSql } from "../db/client.js";

function requireSql() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  return sql;
}

/**
 * Active connected Google Calendar connection, or null.
 */
export async function getConnectedGoogleCalendar() {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, google_account_email, calendar_id, refresh_token_ciphertext,
      status, last_error, connected_at, token_updated_at, created_at, updated_at
    FROM google_calendar_connections
    WHERE status = 'connected'
    ORDER BY connected_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Insert a connection row (tests / future OAuth). Never log ciphertext.
 */
export async function insertGoogleCalendarConnection({
  googleAccountEmail,
  calendarId,
  refreshTokenCiphertext,
  status = "connected",
}) {
  const sql = requireSql();
  if (
    typeof googleAccountEmail !== "string" ||
    !googleAccountEmail.trim() ||
    typeof calendarId !== "string" ||
    !calendarId.trim() ||
    typeof refreshTokenCiphertext !== "string" ||
    !refreshTokenCiphertext
  ) {
    return { ok: false, error: "invalid_input" };
  }
  if (!["connected", "revoked", "error"].includes(status)) {
    return { ok: false, error: "invalid_status" };
  }
  const rows = await sql`
    INSERT INTO google_calendar_connections (
      google_account_email, calendar_id, refresh_token_ciphertext, status
    )
    VALUES (
      ${googleAccountEmail.trim().toLowerCase()},
      ${calendarId.trim()},
      ${refreshTokenCiphertext},
      ${status}
    )
    RETURNING
      id, google_account_email, calendar_id, status,
      last_error, connected_at, token_updated_at, created_at, updated_at
  `;
  return { ok: true, connection: rows[0] };
}
