#!/usr/bin/env node
/**
 * Phase 3.5 Customer Profile acceptance tests.
 */
import { createHmac, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { normalizeCustomerEmail, getCustomerRecurrence } from "../lib/cc/domain/customer-match.js";
import { CUSTOMER_TAG_KEYS } from "../lib/cc/domain/customer-tags.js";
import {
  addCustomerNote,
  findCustomerByEmailNormalized,
  getCustomerById,
  getCustomerNotes,
  getCustomerTags,
  listCustomerLeads,
  resolveOrCreateCustomer,
  setCustomerTags,
} from "../lib/cc/db/customers.js";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import { resolveHttpTestBase } from "./lib/dev-test-server.mjs";

const results = [];

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mintOwnerCookie() {
  const secret = process.env.CC_SESSION_SECRET?.trim();
  assert(secret && secret.length >= 32, "CC_SESSION_SECRET missing");
  const payload = { role: "owner", exp: Date.now() + 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `mcs_cc_session=${body}.${signature}`;
}

function sampleLead(overrides = {}) {
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  return {
    fullName: overrides.fullName || `Phase35 Customer ${stamp}`,
    email: overrides.email || `phase35-${stamp}@example.com`,
    city: overrides.city || "Manvel",
    propertyType: "Residential",
    projectType: overrides.projectType || "TV Mounting",
    description: "Phase 3.5 automated customer matching test — please ignore.",
    contactMethod: "Email",
    preferredDate: null,
    photos: [
      {
        pathname: `quote-requests/phase35-${stamp}.jpg`,
        contentType: "image/jpeg",
        size: 128,
      },
    ],
    ...overrides,
  };
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  const BASE = await resolveHttpTestBase();
  const sql = neon(process.env.DATABASE_URL);
  const cookie = mintOwnerCookie();

  // Domain
  check(
    "normalize_email_case",
    normalizeCustomerEmail("  Steve@Example.COM ") === "steve@example.com"
  );
  check("recurrence_new", getCustomerRecurrence(1) === "new");
  check("recurrence_returning", getCustomerRecurrence(2) === "returning");
  check("tag_catalog_size", CUSTOMER_TAG_KEYS.length === 6);
  check("no_repeat_customer_tag", !CUSTOMER_TAG_KEYS.includes("repeat_customer"));
  check("no_good_payer_tag", !CUSTOMER_TAG_KEYS.includes("good_payer"));

  // Orphans
  const [orphanRow] = await sql`
    SELECT COUNT(*)::int AS count FROM leads WHERE customer_id IS NULL
  `;
  check("orphan_leads_zero", orphanRow.count === 0, `orphans=${orphanRow.count}`);

  // New lead → new customer
  const emailA = `phase35-a-${Date.now()}@example.com`;
  const first = await persistQuoteLead(sampleLead({ email: emailA, fullName: "Alpha One" }));
  check("new_lead_ok", first.ok === true && !!first.customerId);
  const customerA = await findCustomerByEmailNormalized(emailA);
  check("new_customer_created", !!customerA && customerA.id === first.customerId);

  // Second lead same email → same customer
  const second = await persistQuoteLead(
    sampleLead({
      email: emailA,
      fullName: "Alpha Two",
      city: "Alvin",
      projectType: "Furniture Assembly",
    })
  );
  check("second_lead_same_customer", second.ok && second.customerId === first.customerId);

  const leadsA = await listCustomerLeads(first.customerId);
  check("customer_has_two_leads", leadsA.length >= 2, `count=${leadsA.length}`);
  check(
    "lead_cities_preserved",
    leadsA.some((l) => l.city === "Manvel") && leadsA.some((l) => l.city === "Alvin")
  );
  check("returning_derived", getCustomerRecurrence(leadsA.length) === "returning");

  // Case-insensitive email
  const emailCase = `Phase35.Case.${Date.now()}@Example.COM`;
  const c1 = await resolveOrCreateCustomer({
    fullName: "Case Person",
    email: emailCase,
    city: "Manvel",
  });
  const c2 = await resolveOrCreateCustomer({
    fullName: "Case Person Again",
    email: emailCase.toLowerCase(),
    city: "Manvel",
  });
  check("email_case_same_customer", c1.customerId === c2.customerId && c2.created === false);

  // Same name, different emails → no merge
  const stamp = Date.now();
  const n1 = await resolveOrCreateCustomer({
    fullName: "Same Name",
    email: `same-name-a-${stamp}@example.com`,
    city: "Manvel",
  });
  const n2 = await resolveOrCreateCustomer({
    fullName: "Same Name",
    email: `same-name-b-${stamp}@example.com`,
    city: "Manvel",
  });
  check("same_name_no_merge", n1.customerId !== n2.customerId);

  // Notes + tags persist
  const note = await addCustomerNote({
    customerId: first.customerId,
    body: `Phase 3.5 note ${stamp}`,
  });
  check("customer_note_ok", note.ok === true);
  const tags = await setCustomerTags({
    customerId: first.customerId,
    tagKeys: ["price_sensitive", "requires_follow_up"],
  });
  check("customer_tags_ok", tags.ok === true);

  const notesReload = await getCustomerNotes(first.customerId);
  const tagsReload = await getCustomerTags(first.customerId);
  check(
    "note_persists",
    notesReload.some((n) => n.body.includes(`Phase 3.5 note ${stamp}`))
  );
  check(
    "tags_persist",
    tagsReload.map((t) => t.tag_key).sort().join(",") ===
      "price_sensitive,requires_follow_up"
  );

  const refreshed = await getCustomerById(first.customerId);
  check("customer_refresh_ok", !!refreshed && refreshed.id === first.customerId);

  // HTTP auth gates
  for (const path of [
    "/command-center/customers",
    `/command-center/customers/${first.customerId}`,
  ]) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const loc = r.headers.get("location") || "";
    check(
      `auth_${path}`,
      [302, 303, 307].includes(r.status) && loc.includes("/login"),
      `status=${r.status}`
    );
  }

  // Authenticated pages
  const listRes = await fetch(`${BASE}/command-center/customers`, { headers: { cookie } });
  const listHtml = await listRes.text();
  check("customers_list_200", listRes.status === 200);
  check("customers_list_has_name", listHtml.includes(customerA.full_name) || listHtml.includes("Alpha"));

  const detailRes = await fetch(`${BASE}/command-center/customers/${first.customerId}`, {
    headers: { cookie },
  });
  const detailHtml = await detailRes.text();
  check("customer_detail_200", detailRes.status === 200);
  check("customer_detail_returning", detailHtml.includes("Returning Customer"));
  check("customer_detail_has_leads", detailHtml.includes("TV Mounting") || detailHtml.includes("Furniture"));

  const leadDetail = await fetch(`${BASE}/command-center/leads/${first.leadId}`, {
    headers: { cookie },
  });
  const leadHtml = await leadDetail.text();
  check("lead_badge_present", leadDetail.status === 200 && leadHtml.includes("Customer Profile"));

  // Phase 3 smoke
  const dash = await fetch(`${BASE}/command-center`, { headers: { cookie } });
  check("phase3_dashboard_ok", dash.status === 200);
  const leadsPage = await fetch(`${BASE}/command-center/leads`, { headers: { cookie } });
  check("phase3_leads_ok", leadsPage.status === 200);

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
