import { createHmac, timingSafeEqual } from "node:crypto";
import { CC_OWNER_ROLE, CC_SESSION_TTL_MS } from "./constants.js";

function getSessionSecret() {
  const secret = process.env.CC_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("CC_SESSION_SECRET must be set (min 32 characters).");
  }
  return secret;
}

function signPayload(body) {
  return createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
}

function encodeSession(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signPayload(body)}`;
}

/**
 * Decode and verify HMAC session cookie.
 * Returns { role, exp, pv } where pv is number | null.
 * pv === null means a Phase-A-compatible legacy session (pre-password_version).
 */
export function decodeSessionToken(token) {
  if (!token || typeof token !== "string" || token.length > 2048) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  let expected;
  try {
    expected = signPayload(body);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.role !== CC_OWNER_ROLE) return null;
  if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;

  let pv = null;
  if (Object.prototype.hasOwnProperty.call(parsed, "pv")) {
    if (typeof parsed.pv !== "number" || !Number.isInteger(parsed.pv) || parsed.pv < 1) {
      return null;
    }
    pv = parsed.pv;
  }

  return {
    role: parsed.role,
    exp: parsed.exp,
    pv,
  };
}

/**
 * Build owner session token (no cookie write).
 * @param {{ passwordVersion?: number | null, exp?: number }} [opts]
 *   When passwordVersion is a positive integer (DB-backed owner), include pv.
 *   Env-only / legacy sessions omit pv.
 */
export function encodeOwnerSessionToken(opts = {}) {
  const expiresAt =
    typeof opts.exp === "number" ? opts.exp : Date.now() + CC_SESSION_TTL_MS;
  const payload = {
    role: CC_OWNER_ROLE,
    exp: expiresAt,
  };
  if (
    typeof opts.passwordVersion === "number" &&
    Number.isInteger(opts.passwordVersion) &&
    opts.passwordVersion >= 1
  ) {
    payload.pv = opts.passwordVersion;
  }
  return encodeSession(payload);
}

/** @deprecated Use encodeOwnerSessionToken — alias for tests. */
export function encodeOwnerSessionTokenForTests(opts = {}) {
  return encodeOwnerSessionToken(opts);
}
