#!/usr/bin/env node
/**
 * Generate CC_OWNER_PASSWORD_HASH for .env.local / Vercel.
 *
 * Usage:
 *   node scripts/hash-owner-password.mjs "your-strong-password"
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-owner-password.mjs "your-strong-password"');
  process.exit(1);
}

if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const SCRYPT_KEYLEN = 64;
const N = 16384;
const r = 8;
const p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N, r, p });
const encoded = [
  "scrypt",
  String(N),
  String(r),
  String(p),
  salt.toString("base64url"),
  hash.toString("base64url"),
].join(":");

console.log(encoded);
console.error("\nAdd to .env.local / Vercel:");
console.error(`CC_OWNER_PASSWORD_HASH=${encoded}`);
