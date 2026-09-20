/**
 * Signed OAuth state (CSRF + single-use + session-bound).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { OAUTH_STATE_TTL_MS } from "./config.js";

const COOKIE_NAME = "mcs_gc_oauth_nonce";

function signingKey() {
  const key =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.CC_SESSION_SECRET?.trim() ||
    "";
  if (!key) throw new Error("oauth_signing_key_missing");
  return key;
}

function sign(payloadB64) {
  return createHmac("sha256", signingKey())
    .update(payloadB64)
    .digest("base64url");
}

/**
 * @param {{ sessionMarker: string }} args
 * @returns {{ state: string, nonce: string, cookieValue: string, expiresAt: number }}
 */
export function createOAuthState({ sessionMarker }) {
  if (!sessionMarker || typeof sessionMarker !== "string") {
    throw new Error("oauth_session_marker_required");
  }
  const nonce = randomBytes(24).toString("base64url");
  const exp = Date.now() + OAUTH_STATE_TTL_MS;
  const payload = {
    n: nonce,
    s: sessionMarker,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = sign(payloadB64);
  return {
    state: `${payloadB64}.${sig}`,
    nonce,
    cookieValue: nonce,
    expiresAt: exp,
  };
}

/**
 * @param {{
 *   state: string,
 *   cookieNonce: string | null | undefined,
 *   sessionMarker: string
 * }} args
 */
export function validateOAuthState({ state, cookieNonce, sessionMarker }) {
  if (typeof state !== "string" || !state.includes(".")) {
    return { ok: false, error: "invalid_state" };
  }
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return { ok: false, error: "invalid_state" };

  let expected;
  try {
    expected = sign(payloadB64);
  } catch {
    return { ok: false, error: "signing_unavailable" };
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "state_mismatch" };
  }

  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
  } catch {
    return { ok: false, error: "invalid_state_payload" };
  }

  if (!payload?.n || !payload?.s || !payload?.exp) {
    return { ok: false, error: "invalid_state_payload" };
  }
  if (Date.now() > Number(payload.exp)) {
    return { ok: false, error: "state_expired" };
  }
  if (payload.s !== sessionMarker) {
    return { ok: false, error: "session_mismatch" };
  }
  if (!cookieNonce || cookieNonce !== payload.n) {
    return { ok: false, error: "nonce_mismatch" };
  }

  return { ok: true, nonce: payload.n };
}

export function oauthNonceCookieName() {
  return COOKIE_NAME;
}

/**
 * Session marker for binding OAuth state (no secrets).
 * @param {{ role?: string, pv?: number, ownerId?: string } | null} owner
 */
export function ownerSessionMarker(owner) {
  if (!owner) return "";
  const pv = typeof owner.pv === "number" ? String(owner.pv) : "0";
  const oid = owner.ownerId || "env";
  return `owner:${oid}:pv:${pv}`;
}
