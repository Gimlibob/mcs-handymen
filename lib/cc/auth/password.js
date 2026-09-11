import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

/**
 * Format: scrypt:N:r:p:saltB64:hashB64
 * Uses ":" (not "$") so dotenv / Next.js env loading cannot expand segments.
 * Generate with: node scripts/hash-owner-password.mjs "your-password"
 */
export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join(":");
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch {
    return false;
  }

  if (salt.length === 0 || expected.length === 0) return false;

  let actual;
  try {
    actual = scryptSync(password, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function getOwnerPasswordHash() {
  const hash = process.env.CC_OWNER_PASSWORD_HASH?.trim();
  return hash || null;
}
