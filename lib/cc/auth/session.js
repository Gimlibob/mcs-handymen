import { cookies } from "next/headers";
import { CC_SESSION_COOKIE, CC_SESSION_TTL_MS } from "@/lib/cc/auth/constants";
import {
  decodeSessionToken,
  encodeOwnerSessionToken,
} from "@/lib/cc/auth/session-token";

export {
  decodeSessionToken,
  encodeOwnerSessionToken,
  encodeOwnerSessionTokenForTests,
} from "@/lib/cc/auth/session-token";

/** Optimistic cookie check for proxy (no throw on missing secret). */
export function readSessionFromRequestCookies(cookieStore) {
  try {
    const token = cookieStore.get(CC_SESSION_COOKIE)?.value;
    return decodeSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Create owner session cookie.
 * @param {{ passwordVersion?: number }} [opts]
 *   When passwordVersion is a positive integer (DB-backed owner), include pv.
 *   Env-only fallback sessions omit pv (legacy-compatible shape).
 */
export async function createOwnerSession(opts = {}) {
  const token = encodeOwnerSessionToken({
    passwordVersion: opts?.passwordVersion,
  });

  const decoded = decodeSessionToken(token);
  const expiresAt = decoded?.exp ?? Date.now() + CC_SESSION_TTL_MS;

  const cookieStore = await cookies();
  cookieStore.set(CC_SESSION_COOKIE, token, {
    httpOnly: true,
    // Secure only on real HTTPS deploys — local `next start` uses http://localhost.
    secure: process.env.VERCEL_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroyOwnerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(CC_SESSION_COOKIE);
}

export async function getOwnerSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CC_SESSION_COOKIE)?.value;
    return decodeSessionToken(token);
  } catch {
    return null;
  }
}
