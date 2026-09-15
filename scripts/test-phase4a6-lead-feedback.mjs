#!/usr/bin/env node
/**
 * Phase 4A.6 Lead Agent learning feedback acceptance tests.
 *
 * Usage:
 *   node scripts/test-phase4a6-lead-feedback.mjs
 */
import { createHmac, createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { validateLeadAnalysisFeedback } from "../lib/cc/domain/ai-lead-feedback.js";
import {
  getActiveLeadFeedbackForAnalysis,
  submitLeadAnalysisFeedback,
} from "../lib/cc/db/ai-lead-feedback.js";
import { insertLeadAnalysis, getLatestLeadAnalysis } from "../lib/cc/db/ai-lead-analyses.js";
import { getLeadById } from "../lib/cc/db/leads.js";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";


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

function sampleAnalysis(overrides = {}) {
  return {
    factual_summary: "Customer in Manvel requested TV mounting. Scope details are limited.",
    missing_information: ["Wall type", "TV size"],
    questions_to_ask: ["What is the TV size?", "Is the wall drywall or brick?"],
    risks_and_ambiguities: ["Mounting surface unknown"],
    operational_complexity: "medium",
    complexity_rationale: "Unknown wall type can change anchors and time on site.",
    customer_context: {
      recurrence: "new",
      relevant_facts: ["First matched lead for this email"],
      owner_tags: [],
    },
    uncertainties: ["Exact mount location not stated"],
    suggested_next_action: "Ask for wall type and TV size before scheduling a visit",
    ...overrides,
  };
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  const sql = neon(process.env.DATABASE_URL);

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_lead_feedback'
  `;
  check("ai_lead_feedback_table", tables.length === 1);

  const deferred = await sql`
    SELECT c.confdeltype, c.condeferrable, c.condeferred
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'ai_lead_feedback'
      AND c.conname = 'ai_lead_feedback_superseded_by_fkey'
  `;
  check(
    "superseded_by_fk_deferrable",
    deferred[0]?.condeferrable === true,
    `deferrable=${deferred[0]?.condeferrable}`
  );

  // --- Domain validation ---
  check(
    "validate_accept_ok",
    validateLeadAnalysisFeedback({ decision: "accepted" }).ok === true
  );
  check(
    "validate_reject_ok",
    validateLeadAnalysisFeedback({ decision: "rejected" }).ok === true
  );
  check(
    "validate_correct_ok",
    validateLeadAnalysisFeedback({
      decision: "corrected",
      correctedSuggestedNextAction: "Ask for photos of the wall",
    }).ok === true
  );
  check(
    "validate_correct_requires_action",
    validateLeadAnalysisFeedback({ decision: "corrected" }).error ===
      "corrected_action_required"
  );
  check(
    "validate_accept_rejects_action",
    validateLeadAnalysisFeedback({
      decision: "accepted",
      correctedSuggestedNextAction: "nope",
    }).error === "corrected_action_not_allowed"
  );
  check(
    "validate_bad_decision",
    validateLeadAnalysisFeedback({ decision: "maybe" }).error === "invalid_decision"
  );

  // --- Seed lead + analysis ---
  const stamp = Date.now();
  const created = await persistQuoteLead({
    fullName: `Phase4A6 Feedback ${stamp}`,
    email: `phase4a6-${stamp}@example.com`,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: "TV mounting — feedback loop test lead.",
    preferredDate: null,
    contactMethod: "Email",
    photos: [],
  });
  assert(created?.ok && created.leadId, "persistQuoteLead failed");
  const leadId = created.leadId;
  const leadBefore = await getLeadById(leadId);

  const isolationAnchor = new Date().toISOString();
  const [leadsBefore] = await sql`SELECT COUNT(*)::int AS c FROM leads`;
  const [customersBefore] = await sql`SELECT COUNT(*)::int AS c FROM customers`;
  const [notesBefore] = await sql`
    SELECT COUNT(*)::int AS c FROM lead_notes WHERE lead_id = ${leadId}
  `;
  const [playbookBefore] = await sql`SELECT COUNT(*)::int AS c FROM playbook_entries`;
  const [analysesBefore] = await sql`
    SELECT COUNT(*)::int AS c FROM ai_lead_analyses WHERE lead_id = ${leadId}
  `;

  const saved = await insertLeadAnalysis({
    leadId,
    provider: "test",
    model: "mock",
    promptVersion: "lead-agent-4a-v2",
    inputFingerprint: createHash("sha256").update(`fb-${stamp}`).digest("hex").slice(0, 32),
    crmNextActionSnapshot: "Review lead",
    analysis: sampleAnalysis(),
    meta: { test: "4a6" },
    createdBy: "owner",
  });
  assert(saved.ok, "insertLeadAnalysis failed");
  const analysisId = saved.analysis.id;
  const analysisBodyBefore = JSON.stringify(saved.analysis.analysis);

  // --- First accept ---
  const accept = await submitLeadAnalysisFeedback({
    leadId,
    analysisId,
    decision: "accepted",
  });
  check("accept_ok", accept.ok === true, accept.error || "");
  check("accept_decision", accept.feedback?.decision === "accepted");
  check("accept_no_corrected_action", accept.feedback?.corrected_suggested_next_action == null);

  const active1 = await getActiveLeadFeedbackForAnalysis(analysisId);
  check("active_is_accepted", active1?.decision === "accepted");

  // --- Supersede with correct ---
  const correct = await submitLeadAnalysisFeedback({
    leadId,
    analysisId,
    decision: "corrected",
    correctedSuggestedNextAction: "Request wall photos and TV size first",
    correctionNote: "Need visuals before visit",
  });
  check("correct_ok", correct.ok === true, correct.error || "");
  check("correct_decision", correct.feedback?.decision === "corrected");
  check(
    "correct_action_stored",
    correct.feedback?.corrected_suggested_next_action ===
      "Request wall photos and TV size first"
  );

  const active2 = await getActiveLeadFeedbackForAnalysis(analysisId);
  check("active_is_corrected", active2?.id === correct.feedback.id);
  check("only_one_active", active2?.superseded_by == null);

  const [activeCount] = await sql`
    SELECT COUNT(*)::int AS c
    FROM ai_lead_feedback
    WHERE analysis_id = ${analysisId} AND superseded_by IS NULL
  `;
  check("exactly_one_active_row", activeCount.c === 1);

  const [historyCount] = await sql`
    SELECT COUNT(*)::int AS c FROM ai_lead_feedback WHERE analysis_id = ${analysisId}
  `;
  check("append_only_history", historyCount.c === 2);

  const prior = await sql`
    SELECT id, superseded_by, decision
    FROM ai_lead_feedback
    WHERE analysis_id = ${analysisId} AND id = ${accept.feedback.id}
  `;
  check(
    "prior_superseded_to_new",
    prior[0]?.superseded_by === correct.feedback.id && prior[0]?.decision === "accepted"
  );

  // --- Reject supersedes correct ---
  const reject = await submitLeadAnalysisFeedback({
    leadId,
    analysisId,
    decision: "rejected",
    correctionNote: "Not useful for this lead",
  });
  check("reject_ok", reject.ok === true, reject.error || "");
  const active3 = await getActiveLeadFeedbackForAnalysis(analysisId);
  check("active_is_rejected", active3?.decision === "rejected");
  const [activeCount2] = await sql`
    SELECT COUNT(*)::int AS c
    FROM ai_lead_feedback
    WHERE analysis_id = ${analysisId} AND superseded_by IS NULL
  `;
  check("still_one_active", activeCount2.c === 1);

  // --- Validation / auth / mismatch ---
  const badAccept = await submitLeadAnalysisFeedback({
    leadId,
    analysisId,
    decision: "accepted",
    correctedSuggestedNextAction: "should fail",
  });
  check("reject_accept_with_action", badAccept.ok === false);

  const mismatch = await submitLeadAnalysisFeedback({
    leadId: "00000000-0000-4000-8000-000000000099",
    analysisId,
    decision: "accepted",
  });
  check(
    "analysis_lead_mismatch",
    mismatch.ok === false && mismatch.error === "analysis_lead_mismatch"
  );

  const missing = await submitLeadAnalysisFeedback({
    leadId,
    analysisId: "00000000-0000-4000-8000-000000000098",
    decision: "accepted",
  });
  check(
    "analysis_not_found",
    missing.ok === false && missing.error === "analysis_not_found"
  );

  // --- Analysis immutable ---
  const reloaded = await getLatestLeadAnalysis(leadId);
  check(
    "analysis_body_immutable",
    JSON.stringify(reloaded.analysis) === analysisBodyBefore
  );

  // --- CRM / Playbook unchanged ---
  const leadAfter = await getLeadById(leadId);
  check("crm_status_unchanged", leadAfter.status === leadBefore.status);
  check(
    "crm_updated_at_unchanged",
    String(leadAfter.updated_at) === String(leadBefore.updated_at)
  );

  const [notesAfter] = await sql`
    SELECT COUNT(*)::int AS c FROM lead_notes WHERE lead_id = ${leadId}
  `;
  check("lead_notes_unchanged", notesAfter.c === notesBefore.c);

  const [leadsAfter] = await sql`SELECT COUNT(*)::int AS c FROM leads`;
  const [customersAfter] = await sql`SELECT COUNT(*)::int AS c FROM customers`;
  check("leads_count_unchanged", leadsAfter.c === leadsBefore.c);
  check("customers_count_unchanged", customersAfter.c === customersBefore.c);

  const [playbookAfter] = await sql`SELECT COUNT(*)::int AS c FROM playbook_entries`;
  const [playbookInserted] = await sql`
    SELECT COUNT(*)::int AS c FROM playbook_entries WHERE created_at >= ${isolationAnchor}
  `;
  check(
    "playbook_unchanged",
    playbookAfter.c === playbookBefore.c && playbookInserted.c === 0,
    `before=${playbookBefore.c} after=${playbookAfter.c} inserted=${playbookInserted.c}`
  );

  const [analysesAfter] = await sql`
    SELECT COUNT(*)::int AS c FROM ai_lead_analyses WHERE lead_id = ${leadId}
  `;
  check(
    "analyses_count_unchanged_by_feedback",
    analysesAfter.c === analysesBefore.c + 1
  );

  // --- Concurrent-safe: rapid sequential supersessions leave one active ---
  for (let i = 0; i < 3; i++) {
    const r = await submitLeadAnalysisFeedback({
      leadId,
      analysisId,
      decision: i % 2 === 0 ? "accepted" : "rejected",
    });
    assert(r.ok, `rapid supersede ${i} failed: ${r.error}`);
  }
  const [activeFinal] = await sql`
    SELECT COUNT(*)::int AS c
    FROM ai_lead_feedback
    WHERE analysis_id = ${analysisId} AND superseded_by IS NULL
  `;
  check("rapid_supersede_one_active", activeFinal.c === 1);

  // --- HTTP: auth + UI markers (managed Next on TEST_DATABASE_URL) ---
  const { resolveHttpTestBase } = await import("./lib/dev-test-server.mjs");
  const BASE = await resolveHttpTestBase();
  const unauth = await fetch(`${BASE}/command-center/leads/${leadId}`, {
    redirect: "manual",
  });
  check(
    "auth_protect_lead_detail",
    unauth.status === 307 || unauth.status === 302,
    `status=${unauth.status}`
  );

  const cookie = mintOwnerCookie();
  const page = await fetch(`${BASE}/command-center/leads/${leadId}`, {
    headers: { cookie },
  });
  const html = await page.text();
  check("lead_detail_200", page.status === 200);
  check("ui_has_accept", html.includes(">Accept<") || html.includes("Accept"));
  check("ui_has_reject", html.includes(">Reject<") || html.includes("Reject"));
  check("ui_has_correct", html.includes(">Correct<") || html.includes("Correct"));
  check(
    "ui_disclaimer_no_crm_playbook",
    html.includes("does not change CRM") && html.toLowerCase().includes("playbook")
  );

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Phase 4A.6 summary ---");
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }
  console.log(`Lead Detail URL: ${BASE}/command-center/leads/${leadId}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
