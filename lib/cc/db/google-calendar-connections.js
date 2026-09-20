import { getSql } from "../db/client.js";
import { CONNECTION_STATUSES } from "../google-calendar/config.js";

function requireSql() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  return sql;
}

const SELECT_COLS = `
  id, google_account_email, google_account_sub, calendar_id,
  refresh_token_ciphertext, scopes, status, last_error,
  connected_at, token_updated_at, created_at, updated_at
`;

/**
 * Active fully-ready connection (connected + calendar_id + token).
 */
export async function getConnectedGoogleCalendar() {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, google_account_email, google_account_sub, calendar_id,
      refresh_token_ciphertext, scopes, status, last_error,
      connected_at, token_updated_at, created_at, updated_at
    FROM google_calendar_connections
    WHERE status = 'connected'
      AND calendar_id IS NOT NULL
      AND refresh_token_ciphertext IS NOT NULL
    ORDER BY connected_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Latest connection row regardless of status (Account UI).
 */
export async function getLatestGoogleCalendarConnection() {
  const sql = requireSql();
  const rows = await sql`
    SELECT
      id, google_account_email, google_account_sub, calendar_id,
      refresh_token_ciphertext, scopes, status, last_error,
      connected_at, token_updated_at, created_at, updated_at
    FROM google_calendar_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Upsert primary connection (v1: single row lifecycle — update latest or insert).
 */
export async function upsertGoogleCalendarConnection({
  googleAccountEmail,
  googleAccountSub = null,
  calendarId = null,
  refreshTokenCiphertext = null,
  scopes = null,
  status,
  lastError = null,
  clearToken = false,
}) {
  const sql = requireSql();
  if (!CONNECTION_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status" };
  }
  if (
    typeof googleAccountEmail !== "string" ||
    !googleAccountEmail.trim()
  ) {
    return { ok: false, error: "invalid_email" };
  }

  const email = googleAccountEmail.trim().toLowerCase();
  const existing = await getLatestGoogleCalendarConnection();

  if (existing) {
    const nextToken = clearToken
      ? null
      : refreshTokenCiphertext !== null && refreshTokenCiphertext !== undefined
        ? refreshTokenCiphertext
        : existing.refresh_token_ciphertext;
    const nextCal =
      calendarId !== undefined && calendarId !== null
        ? calendarId
        : calendarId === null && clearToken
          ? existing.calendar_id
          : calendarId === null
            ? existing.calendar_id
            : calendarId;

    const calValue =
      calendarId === undefined
        ? existing.calendar_id
        : calendarId;

    const rows = await sql`
      UPDATE google_calendar_connections
      SET
        google_account_email = ${email},
        google_account_sub = ${googleAccountSub ?? existing.google_account_sub},
        calendar_id = ${calValue},
        refresh_token_ciphertext = ${nextToken},
        scopes = ${scopes ?? existing.scopes},
        status = ${status},
        last_error = ${lastError},
        token_updated_at = CASE
          WHEN ${Boolean(refreshTokenCiphertext)} THEN now()
          ELSE token_updated_at
        END,
        connected_at = CASE
          WHEN ${status === "connected"} THEN now()
          ELSE connected_at
        END,
        updated_at = now()
      WHERE id = ${existing.id}
      RETURNING
        id, google_account_email, google_account_sub, calendar_id,
        status, last_error, connected_at, token_updated_at, created_at, updated_at
    `;
    return { ok: true, connection: rows[0] };
  }

  const rows = await sql`
    INSERT INTO google_calendar_connections (
      google_account_email,
      google_account_sub,
      calendar_id,
      refresh_token_ciphertext,
      scopes,
      status,
      last_error
    )
    VALUES (
      ${email},
      ${googleAccountSub},
      ${calendarId},
      ${clearToken ? null : refreshTokenCiphertext},
      ${scopes},
      ${status},
      ${lastError}
    )
    RETURNING
      id, google_account_email, google_account_sub, calendar_id,
      status, last_error, connected_at, token_updated_at, created_at, updated_at
  `;
  return { ok: true, connection: rows[0] };
}

/** @deprecated use upsert — kept for GC-1 tests */
export async function insertGoogleCalendarConnection(args) {
  return upsertGoogleCalendarConnection({
    googleAccountEmail: args.googleAccountEmail,
    calendarId: args.calendarId ?? null,
    refreshTokenCiphertext: args.refreshTokenCiphertext,
    status: args.status || "connected",
    scopes: args.scopes ?? null,
    googleAccountSub: args.googleAccountSub ?? null,
  });
}

export async function updateConnectionCalendarId(connectionId, calendarId) {
  const sql = requireSql();
  const rows = await sql`
    UPDATE google_calendar_connections
    SET
      calendar_id = ${calendarId},
      status = 'connected',
      last_error = NULL,
      updated_at = now()
    WHERE id = ${connectionId}
    RETURNING
      id, google_account_email, google_account_sub, calendar_id,
      status, last_error, connected_at, token_updated_at, created_at, updated_at
  `;
  return rows[0] || null;
}

export async function setConnectionStatus(connectionId, status, lastError = null) {
  const sql = requireSql();
  if (!CONNECTION_STATUSES.includes(status)) {
    return null;
  }
  const rows = await sql`
    UPDATE google_calendar_connections
    SET
      status = ${status},
      last_error = ${lastError},
      updated_at = now()
    WHERE id = ${connectionId}
    RETURNING
      id, google_account_email, google_account_sub, calendar_id,
      status, last_error, connected_at, token_updated_at, created_at, updated_at
  `;
  return rows[0] || null;
}
