import { getSql } from "./client.js";
import {
  CANONICAL_OWNER_EMAIL,
  normalizeOwnerEmail,
} from "../domain/owner-account.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

/**
 * Returns the single owner account, or null.
 * Returns null when the table is missing (migration not applied) or empty.
 */
export async function getOwnerAccount() {
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT
        id,
        email,
        email_normalized,
        password_hash,
        password_version,
        created_at,
        updated_at,
        password_changed_at
      FROM owner_accounts
      ORDER BY created_at ASC
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("[cc/owner] getOwnerAccount failed (table may be absent)");
    return null;
  }
}

/**
 * @param {string} email
 */
export async function getOwnerByEmailNormalized(email) {
  const normalized = normalizeOwnerEmail(email);
  if (!normalized) return null;

  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT
        id,
        email,
        email_normalized,
        password_hash,
        password_version,
        created_at,
        updated_at,
        password_changed_at
      FROM owner_accounts
      WHERE email_normalized = ${normalized}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("[cc/owner] getOwnerByEmailNormalized failed");
    return null;
  }
}

/**
 * Controlled bootstrap: create the canonical owner only when the table is empty.
 * Never overwrites an existing password_hash.
 *
 * @param {{ email?: string, passwordHash: string }} args
 * @returns {{ ok: true, created: boolean, owner: object } | { ok: false, error: string }}
 */
export async function bootstrapOwnerAccount({
  email = CANONICAL_OWNER_EMAIL,
  passwordHash,
}) {
  const sql = requireSql();

  const normalized = normalizeOwnerEmail(email);
  if (!normalized) {
    return { ok: false, error: "invalid_email" };
  }
  if (normalized !== CANONICAL_OWNER_EMAIL) {
    return { ok: false, error: "non_canonical_email" };
  }
  if (typeof passwordHash !== "string" || passwordHash.trim().length < 1) {
    return { ok: false, error: "invalid_password_hash" };
  }

  const existing = await getOwnerAccount();
  if (existing) {
    if (existing.email_normalized !== CANONICAL_OWNER_EMAIL) {
      return { ok: false, error: "conflicting_owner" };
    }
    // Same canonical owner already present — do not overwrite hash.
    return { ok: true, created: false, owner: existing };
  }

  try {
    const rows = await sql`
      INSERT INTO owner_accounts (
        email,
        email_normalized,
        password_hash,
        password_version
      )
      VALUES (
        ${CANONICAL_OWNER_EMAIL},
        ${CANONICAL_OWNER_EMAIL},
        ${passwordHash.trim()},
        1
      )
      RETURNING
        id,
        email,
        email_normalized,
        password_hash,
        password_version,
        created_at,
        updated_at,
        password_changed_at
    `;
    const owner = rows[0];
    if (!owner?.id) {
      return { ok: false, error: "create_failed" };
    }
    return { ok: true, created: true, owner };
  } catch (error) {
    // Race: another bootstrap inserted the singleton first.
    const again = await getOwnerAccount();
    if (again) {
      if (again.email_normalized !== CANONICAL_OWNER_EMAIL) {
        return { ok: false, error: "conflicting_owner" };
      }
      return { ok: true, created: false, owner: again };
    }
    console.error("[cc/owner] bootstrap failed", error?.message || error);
    return { ok: false, error: "create_failed" };
  }
}

export async function countOwnerAccounts() {
  const sql = getSql();
  if (!sql) return 0;
  try {
    const [row] = await sql`SELECT COUNT(*)::int AS c FROM owner_accounts`;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}
