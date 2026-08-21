import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site-config";
import { QUOTE_BLOB_PREFIX } from "@/lib/quote-limits";

const PHOTO_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getSigningSecret() {
  const secret = process.env.BLOB_READ_WRITE_TOKEN || process.env.QUOTE_PHOTO_SECRET;
  if (!secret) {
    throw new Error("Missing blob signing secret");
  }
  return secret;
}

export function getPublicSiteOrigin() {
  if (process.env.VERCEL_ENV === "production") return SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  return SITE_URL.replace(/\/$/, "");
}

function signPayload(payload) {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export function createPrivatePhotoAccessUrl(pathname) {
  if (!pathname?.startsWith(QUOTE_BLOB_PREFIX) || pathname.includes("..")) {
    throw new Error("Invalid photo pathname");
  }

  const body = Buffer.from(
    JSON.stringify({ p: pathname, e: Date.now() + PHOTO_LINK_TTL_MS }),
    "utf8"
  ).toString("base64url");
  const token = `${body}.${signPayload(body)}`;
  return `${getPublicSiteOrigin()}/api/quote-photos?t=${encodeURIComponent(token)}`;
}

export function verifyPrivatePhotoAccessToken(token) {
  if (!token || typeof token !== "string" || token.length > 2048) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = signPayload(body);
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

  if (!parsed?.p || typeof parsed.p !== "string" || typeof parsed.e !== "number") {
    return null;
  }
  if (Date.now() > parsed.e) return null;
  if (!parsed.p.startsWith(QUOTE_BLOB_PREFIX) || parsed.p.includes("..")) return null;

  return parsed.p;
}
