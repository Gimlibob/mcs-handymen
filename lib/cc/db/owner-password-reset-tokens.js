import { createHash, randomBytes } from "node:crypto";
import { getSql } from "./client.js";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
/** Max forgot-password requests per owner within the cooldown window. */
export const FORGOT_PASSWORD_MAX_PER_WINDOW = 3;
export const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

export function hashResetToken(rawToken) {
  return createHash("sha256").update(rawToken, "utf8").digest("base64url");
}

export function generateRawResetToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Count recent reset-token creations for cooldown (any status).
 * Uses persisted Neon rows — safe on serverless.
 */
export async function countRecentResetTokenRequests(ownerId, windowMs = FORGOT_PASSWORD_WINDOW_MS) {
  const sql = getSql();
  if (!sql) return 0;
  const since = new Date(Date.now() - windowMs).toISOString();
  try {
    const [row] = await sql`
      SELECT COUNT(*)::int AS c
      FROM owner_password_reset_tokens
      WHERE owner_id = ${ownerId}
        AND created_at >= ${since}
    `;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Invalidate unused tokens and insert a new one.
 * @returns {{ ok: true, rawToken: string, expiresAt: Date } | { ok: false, error: string }}
 */
export async function createPasswordResetToken(ownerId) {
  const sql = requireSql();
  if (typeof ownerId !== "string" || !ownerId) {
    return { ok: false, error: "invalid_owner" };
  }

  const rawToken = generateRawResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  try {
    await sql.transaction((txn) => [
      txn`
        UPDATE owner_password_reset_tokens
        SET used_at = COALESCE(used_at, now())
        WHERE owner_id = ${ownerId}
          AND used_at IS NULL
      `,
      txn`
        INSERT INTO owner_password_reset_tokens (
          owner_id,
          token_hash,
          expires_at
        )
        VALUES (
          ${ownerId},
          ${tokenHash},
          ${expiresAt.toISOString()}
        )
      `,
    ]);
    return { ok: true, rawToken, expiresAt };
  } catch (error) {
    console.error("[cc/owner-reset] createPasswordResetToken failed");
    return { ok: false, error: "create_failed" };
  }
}

/**
 * @returns {object | null}
 */
export async function getValidResetTokenByRaw(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length < 16) return null;
  const sql = getSql();
  if (!sql) return null;

  const tokenHash = hashResetToken(rawToken);
  try {
    const rows = await sql`
      SELECT
        id,
        owner_id,
        token_hash,
        expires_at,
        used_at,
        created_at
      FROM owner_password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.used_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * Peek token row without validity filter (for UI messaging).
 */
export async function getResetTokenByRaw(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length < 16) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashResetToken(rawToken);
  try {
    const rows = await sql`
      SELECT
        id,
        owner_id,
        token_hash,
        expires_at,
        used_at,
        created_at
      FROM owner_password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Atomically: update password, consume token, invalidate siblings.
 * @param {{ ownerId: string, tokenId: string, passwordHash: string, expectedVersion?: number }} args
 */
export async function resetOwnerPasswordWithToken({
  ownerId,
  tokenId,
  passwordHash,
  expectedVersion,
}) {
  const sql = requireSql();
  if (!ownerId || !tokenId || typeof passwordHash !== "string") {
    return { ok: false, error: "invalid_args" };
  }

  try {
    const results =
      typeof expectedVersion === "number"
        ? await sql.transaction((txn) => [
            txn`
              UPDATE owner_accounts
              SET
                password_hash = ${passwordHash.trim()},
                password_version = password_version + 1,
                password_changed_at = now(),
                updated_at = now()
              WHERE id = ${ownerId}
                AND password_version = ${expectedVersion}
              RETURNING
                id,
                email,
                email_normalized,
                password_hash,
                password_version,
                created_at,
                updated_at,
                password_changed_at
            `,
            txn`
              UPDATE owner_password_reset_tokens
              SET used_at = now()
              WHERE id = ${tokenId}
                AND owner_id = ${ownerId}
                AND used_at IS NULL
                AND expires_at > now()
              RETURNING id
            `,
            txn`
              UPDATE owner_password_reset_tokens
              SET used_at = COALESCE(used_at, now())
              WHERE owner_id = ${ownerId}
                AND used_at IS NULL
                AND id <> ${tokenId}
            `,
          ])
        : await sql.transaction((txn) => [
            txn`
              UPDATE owner_accounts
              SET
                password_hash = ${passwordHash.trim()},
                password_version = password_version + 1,
                password_changed_at = now(),
                updated_at = now()
              WHERE id = ${ownerId}
              RETURNING
                id,
                email,
                email_normalized,
                password_hash,
                password_version,
                created_at,
                updated_at,
                password_changed_at
            `,
            txn`
              UPDATE owner_password_reset_tokens
              SET used_at = now()
              WHERE id = ${tokenId}
                AND owner_id = ${ownerId}
                AND used_at IS NULL
                AND expires_at > now()
              RETURNING id
            `,
            txn`
              UPDATE owner_password_reset_tokens
              SET used_at = COALESCE(used_at, now())
              WHERE owner_id = ${ownerId}
                AND used_at IS NULL
                AND id <> ${tokenId}
            `,
          ]);

    const owner = results[0]?.[0];
    const consumed = results[1]?.[0];
    if (!owner?.id) return { ok: false, error: "version_conflict" };
    if (!consumed?.id) return { ok: false, error: "token_invalid" };
    return { ok: true, owner };
  } catch (error) {
    console.error("[cc/owner-reset] resetOwnerPasswordWithToken failed");
    return { ok: false, error: "reset_failed" };
  }
}
