#!/usr/bin/env node
/**
 * Auth Phase B — Photo API authorization boundary (Development only).
 *
 * Proves getOptionalOwner / password_version gating on
 * GET /api/cc/lead-photos/[photoId] without requiring a live Blob object.
 *
 * Valid-pv authorized path is proven by reaching post-auth handling
 * (200 stream OR 404 when the Blob pathname is absent from the store).
 * A 401 here is a FAIL.
 *
 * Usage:
 *   node scripts/test-phase-auth-b-photo-api.mjs
 */
import { neon } from "@neondatabase/serverless";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { resolveHttpTestBase } from "./lib/dev-test-server.mjs";
import { mintOwnerTestCookie } from "./lib/mint-owner-test-cookie.mjs";

const results = [];

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused: production host");

  const sql = neon(process.env.DATABASE_URL);
  const BASE = await resolveHttpTestBase();

  const [owner] = await sql`
    SELECT id, password_version
    FROM owner_accounts
    ORDER BY created_at ASC
    LIMIT 1
  `;
  assert(owner?.id, "owner_accounts row required on development");
  assert(
    typeof owner.password_version === "number" && owner.password_version >= 1,
    "password_version missing"
  );
  console.log(`owner_password_version=${owner.password_version}`);

  const [photo] = await sql`
    SELECT id, blob_pathname
    FROM lead_photos
    ORDER BY created_at DESC
    LIMIT 1
  `;
  assert(photo?.id, "lead_photos row required on development for photo auth probe");
  console.log(`photo_id=${photo.id}`);

  const url = `${BASE}/api/cc/lead-photos/${photo.id}`;

  // 1) Unauthenticated → 401
  const unauth = await fetch(url, { redirect: "manual" });
  check("unauthenticated_401", unauth.status === 401, `status=${unauth.status}`);

  // 2) Valid pv → must pass auth (not 401). Blob may be missing → 404 is OK.
  const validCookie = await mintOwnerTestCookie({ pv: owner.password_version });
  const valid = await fetch(url, { headers: { cookie: validCookie }, redirect: "manual" });
  const validOk = valid.status === 200 || valid.status === 404;
  check(
    "valid_pv_authorized_path",
    validOk && valid.status !== 401,
    `status=${valid.status} (200 stream or 404 missing blob; 401=auth fail)`
  );
  if (valid.status === 200) {
    const ctype = valid.headers.get("content-type") || "";
    check("valid_pv_image_stream", ctype.startsWith("image/"), `content-type=${ctype}`);
  } else if (valid.status === 404) {
    check(
      "valid_pv_post_auth_blob_miss",
      true,
      "auth passed; Blob pathname absent (expected fixture gap)"
    );
  }

  // 3) Stale / wrong pv → 401
  const stalePv = owner.password_version + 99;
  const staleCookie = await mintOwnerTestCookie({ pv: stalePv });
  const stale = await fetch(url, { headers: { cookie: staleCookie }, redirect: "manual" });
  check("stale_pv_rejected_401", stale.status === 401, `status=${stale.status} pv=${stalePv}`);

  // 4) Legacy no-pv → 401 (Phase B: no compatibility bypass)
  const legacyCookie = await mintOwnerTestCookie({ omitPv: true });
  const legacy = await fetch(url, { headers: { cookie: legacyCookie }, redirect: "manual" });
  check("legacy_no_pv_rejected_401", legacy.status === 401, `status=${legacy.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhoto API auth: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("Photo API auth: PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
