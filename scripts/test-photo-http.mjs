#!/usr/bin/env node
/**
 * HTTP smoke: unauth photo 401 + owner session photo 200 + Next Action on detail.
 *
 * Uses TEST_DATABASE_URL for SQL and a managed Next process bound to the same DB.
 * Does not fall back to Production .env.local DATABASE_URL.
 */
import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { list } from "@vercel/blob";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { resolveHttpTestBase } from "./lib/dev-test-server.mjs";

const COOKIE = "mcs_cc_session";

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
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  const BASE = await resolveHttpTestBase();
  const sql = neon(process.env.DATABASE_URL);

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.log("SKIP — BLOB_READ_WRITE_TOKEN missing; cannot verify private photo stream");
    return;
  }

  const listed = await list({ prefix: "quote-requests/", limit: 1000 });
  const existing = new Set((listed.blobs || []).map((b) => b.pathname));

  // Prefer a development-branch lead that still has a live Blob object.
  const photos = await sql`
    SELECT p.id, p.blob_pathname, p.lead_id, l.status
    FROM lead_photos p
    JOIN leads l ON l.id = p.lead_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `;
  const photo =
    photos.find((p) => existing.has(p.blob_pathname)) || photos[0];
  assert(photo?.id, "no lead_photos rows on development DB");

  if (!existing.has(photo.blob_pathname)) {
    console.log(
      "SKIP — development photo pathname not present in Blob store; not forcing Production Blob writes"
    );
    return;
  }

  const leadId = photo.lead_id;

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

  const detail = await fetch(`${BASE}/command-center/leads/${leadId}`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert(detail.status === 200, `lead detail ${detail.status}`);
  const html = await detail.text();
  assert(html.includes("Next Action"), "Next Action section missing");
  console.log("PASS — lead detail shows Next Action");

  console.log(`Visual URL: ${BASE}/command-center/leads/${leadId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
