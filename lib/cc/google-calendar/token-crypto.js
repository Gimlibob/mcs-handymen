/**
 * Refresh-token encryption helpers (GC-1 stub).
 * Production key must come from env — never commit keys.
 * Tests may use GOOGLE_TOKEN_ENCRYPTION_KEY or TEST_GOOGLE_TOKEN_ENCRYPTION_KEY.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function resolveKeyMaterial() {
  const raw =
    process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    "";
  if (!raw) return null;
  // Derive 32-byte key from arbitrary secret string
  return createHash("sha256").update(raw, "utf8").digest();
}

/**
 * @param {string} plaintext
 * @returns {string} ciphertext package (iv:tag:data) base64url segments
 */
export function encryptRefreshToken(plaintext) {
  if (typeof plaintext !== "string" || !plaintext) {
    throw new Error("encrypt_invalid_input");
  }
  const key = resolveKeyMaterial();
  if (!key) throw new Error("encryption_key_missing");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

/**
 * @param {string} ciphertext
 * @returns {string}
 */
export function decryptRefreshToken(ciphertext) {
  if (typeof ciphertext !== "string" || !ciphertext) {
    throw new Error("decrypt_invalid_input");
  }
  // Test doubles may store clearly fake values without encryption
  if (ciphertext.startsWith("fake-ciphertext:")) {
    return ciphertext.slice("fake-ciphertext:".length);
  }
  const key = resolveKeyMaterial();
  if (!key) throw new Error("encryption_key_missing");
  const parts = ciphertext.split(".");
  if (parts.length !== 3) throw new Error("decrypt_invalid_format");
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
