#!/usr/bin/env node
/**
 * Phase 4A.5.b — Playbook owner UI (draft-only) acceptance tests.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import {
  createPlaybookEntryWithDraft,
  getPlaybookEntryById,
  getPlaybookRevisionById,
  listPlaybookEntries,
  updatePlaybookDraftRevision,
  updatePlaybookEntryMetadata,
} from "../lib/cc/db/playbook.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.CC_TEST_BASE || "http://127.0.0.1:3000";
const __dirname = dirname(fileURLToPath(import.meta.url));
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

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);
  const cookie = mintOwnerCookie();
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;

  // Guardrails in source — no approve/retire UI actions in this slice
  const formsPath = join(__dirname, "..", "components", "cc", "PlaybookForms.js");
  const formsSrc = readFileSync(formsPath, "utf8");
  check("ui_has_no_approve_action", !/approvePlaybook|Approve revision/i.test(formsSrc));
  check("ui_has_no_retire_action", !/retirePlaybook|Retire revision/i.test(formsSrc));

  const leadAgentAnalyze = readFileSync(
    join(__dirname, "..", "lib", "cc", "ai", "lead-agent", "analyze.js"),
    "utf8"
  );
  const leadAgentContext = readFileSync(
    join(__dirname, "..", "lib", "cc", "ai", "lead-agent", "context.js"),
    "utf8"
  );
  check(
    "lead_agent_no_playbook_import",
    !leadAgentAnalyze.includes("playbook") && !leadAgentContext.includes("playbook")
  );

  const actionsSrc = readFileSync(
    join(__dirname, "..", "lib", "cc", "actions", "playbook.js"),
    "utf8"
  );
  check("actions_no_approve_export", !/approvePlaybook|retirePlaybook/i.test(actionsSrc));

  const [leadsBefore] = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  const [customersBefore] = await sql`SELECT COUNT(*)::int AS count FROM customers`;
  const [aiBefore] = await sql`SELECT COUNT(*)::int AS count FROM ai_lead_analyses`;

  // Create entry + draft
  const created = await createPlaybookEntryWithDraft({
    slug: `ui-4a5b-${stamp}`,
    category: "lead_qualification",
    title: `Phase 4A.5.b UI ${stamp}`,
    serviceKeys: ["general_handyman", "tv_mounting"],
    tags: ["ui-test"],
    sensitivity: "operational",
    validationState: "discussion",
    summary: "Draft summary for filter search",
    bodyMd: "Initial draft body content.",
    changeNote: "created by 4A.5.b test",
    createdBy: "test",
  });
  check("create_entry_with_draft", created.ok === true, created.error || "");
  const entryId = created.entry.id;
  const revisionId = created.revision.id;

  // Update draft
  const updatedDraft = await updatePlaybookDraftRevision({
    revisionId,
    summary: "Updated draft summary",
    bodyMd: "Updated draft body after edit.",
    changeNote: "edited draft",
  });
  check("update_draft_ok", updatedDraft.ok === true && updatedDraft.revision.status === "draft");

  const reloaded = await getPlaybookRevisionById(revisionId);
  check(
    "draft_persists_after_reload",
    reloaded?.body_md === "Updated draft body after edit." &&
      reloaded?.summary === "Updated draft summary"
  );

  // Metadata update
  const meta = await updatePlaybookEntryMetadata({
    entryId,
    title: `Phase 4A.5.b UI renamed ${stamp}`,
    category: "service_area",
    serviceKeys: ["general_handyman"],
    tags: ["ui-test", "renamed"],
    sensitivity: "commercial",
    validationState: "hypothesis",
  });
  check("update_entry_metadata_ok", meta.ok === true);
  const entryReload = await getPlaybookEntryById(entryId);
  check(
    "metadata_persists",
    entryReload?.title.includes("renamed") && entryReload?.validation_state === "hypothesis"
  );

  // Filters
  const byCategory = await listPlaybookEntries({ category: "service_area", limit: 100 });
  check(
    "filter_category",
    byCategory.some((e) => e.id === entryId)
  );
  const byService = await listPlaybookEntries({ serviceKey: "general_handyman", limit: 100 });
  check(
    "filter_service",
    byService.some((e) => e.id === entryId)
  );
  const byValidation = await listPlaybookEntries({
    validationState: "hypothesis",
    limit: 100,
  });
  check(
    "filter_validation_state",
    byValidation.some((e) => e.id === entryId)
  );
  const bySensitivity = await listPlaybookEntries({
    sensitivity: "commercial",
    limit: 100,
  });
  check(
    "filter_sensitivity",
    bySensitivity.some((e) => e.id === entryId)
  );
  const bySearch = await listPlaybookEntries({
    q: `renamed ${stamp}`,
    limit: 100,
  });
  check(
    "filter_search",
    bySearch.some((e) => e.id === entryId)
  );
  const byDraftStatus = await listPlaybookEntries({
    revisionStatus: "draft",
    limit: 100,
  });
  check(
    "filter_revision_status_draft",
    byDraftStatus.some((e) => e.id === entryId)
  );

  // Cannot edit approved — simulate by forcing status then updateDraft
  await sql`
    UPDATE playbook_revisions
    SET status = 'approved', approved_at = now(), approved_by = 'test-force'
    WHERE id = ${revisionId}
  `;
  const blocked = await updatePlaybookDraftRevision({
    revisionId,
    summary: "should fail",
    bodyMd: "should not write",
    changeNote: "blocked",
  });
  check(
    "cannot_edit_approved_revision",
    blocked.ok === false && blocked.error === "not_draft"
  );
  const afterBlock = await getPlaybookRevisionById(revisionId);
  check(
    "approved_body_unchanged",
    afterBlock?.body_md === "Updated draft body after edit."
  );

  // Restore to draft for cleanliness (test-only; no UI approve path)
  await sql`
    UPDATE playbook_revisions
    SET status = 'draft', approved_at = NULL, approved_by = NULL
    WHERE id = ${revisionId}
  `;

  // Isolation
  const [leadsAfter] = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  const [customersAfter] = await sql`SELECT COUNT(*)::int AS count FROM customers`;
  const [aiAfter] = await sql`SELECT COUNT(*)::int AS count FROM ai_lead_analyses`;
  check("crm_leads_unchanged", leadsAfter.count === leadsBefore.count);
  check("crm_customers_unchanged", customersAfter.count === customersBefore.count);
  check("ai_analyses_unchanged", aiAfter.count === aiBefore.count);

  // HTTP auth + UI
  let httpOk = false;
  try {
    const probe = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
    httpOk = probe.ok;
  } catch {
    httpOk = false;
  }

  if (!httpOk) {
    check("http_skipped_no_server", true, `start server at ${BASE}`);
  } else {
    for (const path of [
      "/command-center/playbook",
      "/command-center/playbook/new",
      `/command-center/playbook/${entryId}`,
    ]) {
      const unauth = await fetch(`${BASE}${path}`, { redirect: "manual" });
      const loc = unauth.headers.get("location") || "";
      check(
        `auth_protect_${path}`,
        [302, 303, 307].includes(unauth.status) && loc.includes("/login"),
        `status=${unauth.status}`
      );
    }

    const list = await fetch(`${BASE}/command-center/playbook`, { headers: { cookie } });
    const listHtml = await list.text();
    check("playbook_list_200", list.status === 200);
    check("playbook_nav_present", listHtml.includes(">Playbook<") || listHtml.includes("Playbook"));
    check("playbook_new_link", listHtml.includes("/command-center/playbook/new"));
    check("playbook_no_approve_button", !/Approve revision/i.test(listHtml));

    const filtered = await fetch(
      `${BASE}/command-center/playbook?category=service_area&validation=hypothesis`,
      { headers: { cookie } }
    );
    const filteredHtml = await filtered.text();
    check("playbook_filter_http", filtered.status === 200 && filteredHtml.includes(stamp));

    const detail = await fetch(`${BASE}/command-center/playbook/${entryId}`, {
      headers: { cookie },
    });
    const detailHtml = await detail.text();
    check("playbook_detail_200", detail.status === 200);
    check("playbook_detail_has_history", detailHtml.includes("Versions"));
    check("playbook_detail_draft_only_banner", detailHtml.includes("Draft-only"));
    check("playbook_detail_no_approve", !/name="approve"|Approve revision/i.test(detailHtml));
    check("playbook_detail_no_retire", !/name="retire"|Retire revision/i.test(detailHtml));

    const neu = await fetch(`${BASE}/command-center/playbook/new`, { headers: { cookie } });
    const neuHtml = await neu.text();
    check("playbook_new_200", neu.status === 200);
    check("playbook_new_form", neuHtml.includes("Save draft rule") || neuHtml.includes("Rule name"));
    check("playbook_new_human_labels", neuHtml.includes("Applies to") && neuHtml.includes("MCS rule / procedure"));
    check("playbook_new_no_visible_slug_field", !neuHtml.includes('id="pb-slug"'));
    check(
      "playbook_new_validation_labels",
      neuHtml.includes("Validated MCS rule") && neuHtml.includes("Working hypothesis")
    );

    // Lead detail still has no Playbook agent exposure wording from retrieval
    const [lead] = await sql`SELECT id FROM leads ORDER BY created_at DESC LIMIT 1`;
    if (lead?.id) {
      const leadPage = await fetch(`${BASE}/command-center/leads/${lead.id}`, {
        headers: { cookie },
      });
      const leadHtml = await leadPage.text();
      check(
        "lead_agent_no_playbook_retrieval_ui",
        leadPage.status === 200 && !leadHtml.includes("APPROVED_MCS_PLAYBOOK")
      );
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Phase 4A.5.b summary ---");
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  console.log(`Playbook URL: ${BASE}/command-center/playbook`);
  console.log(`Entry URL: ${BASE}/command-center/playbook/${entryId}`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
