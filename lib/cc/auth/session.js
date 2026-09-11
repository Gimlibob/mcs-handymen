import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { CC_OWNER_ROLE, CC_SESSION_COOKIE, CC_SESSION_TTL_MS } from "@/lib/cc/auth/constants";

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

  return {
    role: parsed.role,
    exp: parsed.exp,
  };
}

/** Optimistic cookie check for proxy (no throw on missing secret). */
export function readSessionFromRequestCookies(cookieStore) {
  try {
    const token = cookieStore.get(CC_SESSION_COOKIE)?.value;
    return decodeSessionToken(token);
  } catch {
    return null;
  }
}

export async function createOwnerSession() {
  const expiresAt = Date.now() + CC_SESSION_TTL_MS;
  const token = encodeSession({
    role: CC_OWNER_ROLE,
    exp: expiresAt,
  });

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
