#!/usr/bin/env node
/**
 * HTTP smoke: unauth photo 401 + owner session photo 200 + Next Action on detail.
 */
import { createHmac } from "node:crypto";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { list } from "@vercel/blob";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.CC_TEST_BASE || "http://localhost:3000";
const COOKIE = "mcs_cc_session";
const GOOD_LEAD = "16ed868e-a451-4cc6-8038-cf8a58a1818e";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mintOwnerCookie() {
  const secret = process.env.CC_SESSION_SECRET?.trim();
  assert(secret && secret.length >= 32, "CC_SESSION_SECRET missing");
  const payload = {
    role: "owner",
    exp: Date.now() + 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${COOKIE}=${body}.${signature}`;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const listed = await list({ prefix: "quote-requests/", limit: 1000 });
  const existing = new Set((listed.blobs || []).map((b) => b.pathname));

  const photos = await sql`
    SELECT id, blob_pathname FROM lead_photos
    WHERE lead_id = ${GOOD_LEAD}
    ORDER BY created_at DESC
  `;
  const photo = photos.find((p) => existing.has(p.blob_pathname)) || photos[0];
  assert(photo?.id, "good lead photo missing");

  const unauth = await fetch(`${BASE}/api/cc/lead-photos/${photo.id}`, {
    redirect: "manual",
  });
  assert(unauth.status === 401, `expected 401 unauth photo, got ${unauth.status}`);
  console.log("PASS — unauth photo 401");

  const cookie = mintOwnerCookie();
  const authPhoto = await fetch(`${BASE}/api/cc/lead-photos/${photo.id}`, {
    headers: { cookie },
  });
  assert(authPhoto.status === 200, `expected 200 auth photo, got ${authPhoto.status}`);
  const ctype = authPhoto.headers.get("content-type") || "";
  assert(ctype.startsWith("image/"), `expected image content-type, got ${ctype}`);
  const buf = Buffer.from(await authPhoto.arrayBuffer());
  assert(buf.length > 100, "photo body too small");
  console.log("PASS — owner private photo stream", buf.length, "bytes", ctype);

  const detail = await fetch(`${BASE}/command-center/leads/${GOOD_LEAD}`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert(detail.status === 200, `lead detail ${detail.status}`);
  const html = await detail.text();
  assert(html.includes("Next Action"), "Next Action section missing");
  assert(html.includes("Review lead"), "expected next action for new lead");
  console.log("PASS — lead detail shows Next Action");

  console.log(`Visual URL: ${BASE}/command-center/leads/${GOOD_LEAD}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
