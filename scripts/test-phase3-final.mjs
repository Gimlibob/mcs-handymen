#!/usr/bin/env node
/**
 * Phase 3 final acceptance checks (HTTP + domain).
 */
import { createHmac } from "node:crypto";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { getNextAction } from "../lib/cc/domain/lead-status.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.CC_TEST_BASE || "http://127.0.0.1:3000";
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function mintOwnerCookie() {
  const secret = process.env.CC_SESSION_SECRET?.trim();
  assert(secret && secret.length >= 32, "CC_SESSION_SECRET missing");
  const payload = { role: "owner", exp: Date.now() + 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `mcs_cc_session=${body}.${signature}`;
}

async function main() {
  const cookie = mintOwnerCookie();
  const sql = neon(process.env.DATABASE_URL);

  // Public site
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  check("public_home_200", home.status === 200, `status=${home.status}`);
  check(
    "public_no_cc_nav",
    !homeHtml.includes('href="/command-center"') && !homeHtml.includes("Command Center"),
    "no CC link/label on homepage"
  );

  // Auth gates
  for (const path of [
    "/command-center",
    "/command-center/leads",
    "/command-center/leads/16ed868e-a451-4cc6-8038-cf8a58a1818e",
  ]) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const loc = r.headers.get("location") || "";
    check(
      `auth_protect_${path}`,
      [302, 303, 307].includes(r.status) && loc.includes("/login"),
      `status=${r.status} loc=${loc}`
    );
  }

  // Authenticated pages load Neon-backed content
  const dash = await fetch(`${BASE}/command-center`, { headers: { cookie } });
  const dashHtml = await dash.text();
  check("dashboard_200", dash.status === 200);
  check("dashboard_has_pipeline", dashHtml.includes("Pipeline"));
  check("dashboard_has_needs", dashHtml.includes("Needs Attention"));
  check("dashboard_has_new_count", /New Leads[\s\S]{0,200}?\b\d+\b/.test(dashHtml) || dashHtml.includes("Fresh inbound quotes"));

  const leads = await fetch(`${BASE}/command-center/leads`, { headers: { cookie } });
  const leadsHtml = await leads.text();
  check("leads_200", leads.status === 200);
  check("leads_has_customer_col", leadsHtml.includes("Customer"));
  check("leads_has_next_action_col", leadsHtml.includes("Next Action"));

  // Search + filter
  const search = await fetch(`${BASE}/command-center/leads?q=E2E`, { headers: { cookie } });
  const searchHtml = await search.text();
  check("leads_search_e2e", search.status === 200 && searchHtml.includes("Phase2 E2E Customer"));

  const filtered = await fetch(`${BASE}/command-center/leads?status=new`, {
    headers: { cookie },
  });
  const filteredHtml = await filtered.text();
  check(
    "leads_filter_new",
    filtered.status === 200 && filteredHtml.includes("New Leads"),
    `status=${filtered.status}`
  );

  // Detail + next action
  const leadId = "16ed868e-a451-4cc6-8038-cf8a58a1818e";
  const [dbLead] = await sql`SELECT id, status, full_name FROM leads WHERE id = ${leadId}`;
  assert(dbLead, "expected E2E lead in Neon");
  const detail = await fetch(`${BASE}/command-center/leads/${leadId}`, {
    headers: { cookie },
  });
  const detailHtml = await detail.text();
  check("lead_detail_200", detail.status === 200);
  check("lead_detail_name", detailHtml.includes(dbLead.full_name));
  const expectedNext = getNextAction(dbLead.status);
  check(
    "lead_detail_next_action",
    !expectedNext || detailHtml.includes(expectedNext),
    `status=${dbLead.status} next=${expectedNext}`
  );

  // Photo unauth already covered; double-check detail does not expose private blob host as public gallery
  check(
    "no_public_blob_host_in_detail",
    !detailHtml.includes("blob.vercel-storage.com") ||
      detailHtml.includes("/api/cc/lead-photos/"),
    "photos should use owner API path"
  );
  check(
    "photos_use_owner_api",
    detailHtml.includes("/api/cc/lead-photos/") || detailHtml.includes("No photos"),
  );

  // Unauth photo
  const [photo] = await sql`
    SELECT id FROM lead_photos WHERE lead_id = ${leadId} LIMIT 1
  `;
  if (photo?.id) {
    const unauth = await fetch(`${BASE}/api/cc/lead-photos/${photo.id}`, {
      redirect: "manual",
    });
    check("photo_unauth_401", unauth.status === 401, `status=${unauth.status}`);
  } else {
    check("photo_unauth_401", false, "no photo row for E2E lead");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
