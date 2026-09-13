#!/usr/bin/env node
/**
 * Phase 4A.5.c — Playbook Approve + deterministic Lead Agent retrieval.
 *
 * Usage:
 *   node scripts/test-phase4a5c-playbook-approve-retrieval.mjs
 */
import { createHmac } from "node:crypto";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { LEAD_AGENT_PROMPT_VERSION } from "../lib/cc/ai/config.js";
import { buildLeadAgentContext } from "../lib/cc/ai/lead-agent/context.js";
import {
  playbookServiceKeysMatchLead,
  retrieveApprovedPlaybookForLead,
} from "../lib/cc/ai/lead-agent/playbook-retrieval.js";
import { LEAD_AGENT_PLAYBOOK_MAX_ENTRIES } from "../lib/cc/domain/playbook.js";
import { submitLeadAnalysisFeedback } from "../lib/cc/db/ai-lead-feedback.js";
import { insertLeadAnalysis } from "../lib/cc/db/ai-lead-analyses.js";
import {
  approvePlaybookRevision,
  createPlaybookDraftRevision,
  createPlaybookEntryWithDraft,
  retirePlaybookRevision,
  updatePlaybookDraftRevision,
  updatePlaybookEntryMetadata,
} from "../lib/cc/db/playbook.js";
import { getLeadById } from "../lib/cc/db/leads.js";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.CC_TEST_BASE || "http://127.0.0.1:3000";
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
  const stamp = Date.now();

  check("prompt_version_v3", LEAD_AGENT_PROMPT_VERSION === "lead-agent-4a-v3");
  check("retrieval_max_bound", LEAD_AGENT_PLAYBOOK_MAX_ENTRIES >= 1 && LEAD_AGENT_PLAYBOOK_MAX_ENTRIES <= 20);

  // --- Lead for retrieval ---
  const leadRes = await persistQuoteLead({
    fullName: `Phase4A5c Lead ${stamp}`,
    email: `phase4a5c-${stamp}@example.com`,
    city: "Alvin",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: "Need a TV mounted on drywall.",
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  assert(leadRes.ok && leadRes.leadId, "persist lead failed");
  const leadId = leadRes.leadId;
  const lead = await getLeadById(leadId);
  const leadBefore = { status: lead.status, updated_at: String(lead.updated_at) };
  const [pbCountBefore] = await sql`SELECT COUNT(*)::int AS c FROM playbook_entries`;

  // --- Validated entry can approve ---
  const validated = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-validated-${stamp}`,
    category: "lead_qualification",
    title: `Validated TV mount rule ${stamp}`,
    serviceKeys: ["tv-mounting"],
    tags: ["4a5c"],
    sensitivity: "operational",
    validationState: "validated",
    summary: "Ask wall type before scheduling TV mounts.",
    bodyMd: "For TV mounting leads, confirm wall type and TV size before site visit.",
    createdBy: "test",
  });
  assert(validated.ok, "create validated entry");
  const entryId = validated.entry.id;
  const draftId = validated.revision.id;

  const hyp = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-hyp-${stamp}`,
    category: "lead_qualification",
    title: `Hypothesis ${stamp}`,
    serviceKeys: ["*"],
    tags: [],
    sensitivity: "operational",
    validationState: "hypothesis",
    summary: "Should not approve",
    bodyMd: "Hypothesis body",
    createdBy: "test",
  });
  assert(hyp.ok, "create hypothesis");

  const disc = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-disc-${stamp}`,
    category: "lead_qualification",
    title: `Discussion ${stamp}`,
    serviceKeys: ["*"],
    tags: [],
    sensitivity: "operational",
    validationState: "discussion",
    summary: "Should not approve",
    bodyMd: "Discussion body",
    createdBy: "test",
  });
  assert(disc.ok, "create discussion");

  const approveOk = await approvePlaybookRevision({
    entryId,
    revisionId: draftId,
    approvedBy: "owner",
  });
  check("validated_draft_can_approve", approveOk.ok === true, approveOk.error || "");
  check(
    "approval_sets_current_approved_revision_id",
    approveOk.entry?.current_approved_revision_id === draftId
  );
  check("approved_status", approveOk.revision?.status === "approved");

  const hypDeny = await approvePlaybookRevision({
    entryId: hyp.entry.id,
    revisionId: hyp.revision.id,
    approvedBy: "owner",
  });
  check(
    "hypothesis_cannot_approve",
    hypDeny.ok === false && hypDeny.error === "entry_not_validated"
  );

  const discDeny = await approvePlaybookRevision({
    entryId: disc.entry.id,
    revisionId: disc.revision.id,
    approvedBy: "owner",
  });
  check(
    "discussion_cannot_approve",
    discDeny.ok === false && discDeny.error === "entry_not_validated"
  );

  // --- Second approval retires previous ---
  const draft2 = await createPlaybookDraftRevision({
    entryId,
    summary: "Updated rule",
    bodyMd: "Confirm wall type, TV size, and stud location.",
    createdBy: "test",
  });
  assert(draft2.ok, "second draft");
  const approve2 = await approvePlaybookRevision({
    entryId,
    revisionId: draft2.revision.id,
    approvedBy: "owner",
  });
  check("second_approval_ok", approve2.ok === true, approve2.error || "");
  check(
    "pointer_moves_to_second",
    approve2.entry?.current_approved_revision_id === draft2.revision.id
  );

  const [oldRev] = await sql`
    SELECT status, retired_at FROM playbook_revisions WHERE id = ${draftId}
  `;
  check("previous_approved_retired", oldRev.status === "retired" && !!oldRev.retired_at);

  const [approvedCount] = await sql`
    SELECT COUNT(*)::int AS c
    FROM playbook_revisions
    WHERE entry_id = ${entryId} AND status = 'approved'
  `;
  check("invariant_one_approved", approvedCount.c === 1);

  // --- Cannot edit approved in place ---
  const editApproved = await updatePlaybookDraftRevision({
    revisionId: draft2.revision.id,
    summary: "hack",
    bodyMd: "should fail",
  });
  check(
    "approved_cannot_edit_in_place",
    editApproved.ok === false && editApproved.error === "not_draft"
  );

  // --- Retrieval ---
  check(
    "service_keys_match_helper",
    playbookServiceKeysMatchLead(["tv-mounting"], lead) === true
  );

  const retrieved = await retrieveApprovedPlaybookForLead(lead);
  check("retrieval_includes_approved", retrieved.revisionIds.includes(draft2.revision.id));
  check("retrieval_excludes_retired", !retrieved.revisionIds.includes(draftId));
  check(
    "retrieval_excludes_hypothesis_draft",
    !retrieved.revisionIds.includes(hyp.revision.id)
  );

  const draftOnly = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-draftonly-${stamp}`,
    category: "lead_qualification",
    title: `Draft only ${stamp}`,
    serviceKeys: ["tv-mounting"],
    tags: [],
    sensitivity: "operational",
    validationState: "validated",
    summary: "Never retrieve until approved",
    bodyMd: "SECRET_DRAFT_MARKER_4A5C",
    createdBy: "test",
  });
  assert(draftOnly.ok, "draft only entry");
  const retrieved2 = await retrieveApprovedPlaybookForLead(lead);
  check(
    "drafts_never_in_retrieval",
    !retrieved2.text.includes("SECRET_DRAFT_MARKER_4A5C") &&
      !retrieved2.revisionIds.includes(draftOnly.revision.id)
  );

  const unrelated = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-unrelated-${stamp}`,
    category: "lead_qualification",
    title: `Rescreening only ${stamp}`,
    serviceKeys: ["rescreening"],
    tags: [],
    sensitivity: "operational",
    validationState: "validated",
    summary: "Screens",
    bodyMd: "UNRELATED_SCREEN_MARKER",
    createdBy: "test",
  });
  assert(unrelated.ok, "unrelated");
  const approveUnrel = await approvePlaybookRevision({
    entryId: unrelated.entry.id,
    revisionId: unrelated.revision.id,
    approvedBy: "owner",
  });
  assert(approveUnrel.ok, "approve unrelated");
  const retrieved3 = await retrieveApprovedPlaybookForLead(lead);
  check(
    "unrelated_service_excluded",
    !retrieved3.text.includes("UNRELATED_SCREEN_MARKER") &&
      !retrieved3.revisionIds.includes(unrelated.revision.id)
  );

  const workProc = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-workproc-${stamp}`,
    category: "work_procedure",
    title: `Work procedure ${stamp}`,
    serviceKeys: ["tv-mounting"],
    tags: [],
    sensitivity: "operational",
    validationState: "validated",
    summary: "Job prep style",
    bodyMd: "WORK_PROC_MARKER",
    createdBy: "test",
  });
  assert(workProc.ok, "work procedure");
  const approveWp = await approvePlaybookRevision({
    entryId: workProc.entry.id,
    revisionId: workProc.revision.id,
    approvedBy: "owner",
  });
  assert(approveWp.ok, "approve work proc");
  const retrieved4 = await retrieveApprovedPlaybookForLead(lead);
  check(
    "ineligible_category_excluded",
    !retrieved4.text.includes("WORK_PROC_MARKER")
  );

  const internal = await createPlaybookEntryWithDraft({
    slug: `test-4a5c-internal-${stamp}`,
    category: "lead_qualification",
    title: `Internal ${stamp}`,
    serviceKeys: ["*"],
    tags: [],
    sensitivity: "internal_employee",
    validationState: "validated",
    summary: "Staff only",
    bodyMd: "INTERNAL_EMPLOYEE_MARKER",
    createdBy: "test",
  });
  assert(internal.ok, "internal");
  const approveInt = await approvePlaybookRevision({
    entryId: internal.entry.id,
    revisionId: internal.revision.id,
    approvedBy: "owner",
  });
  assert(approveInt.ok, "approve internal");
  const retrieved5 = await retrieveApprovedPlaybookForLead(lead);
  check(
    "internal_employee_excluded",
    !retrieved5.text.includes("INTERNAL_EMPLOYEE_MARKER")
  );

  check(
    "retrieval_bounded",
    retrieved5.entries.length <= LEAD_AGENT_PLAYBOOK_MAX_ENTRIES
  );

  // Zero match lead (weird project type)
  const zeroLeadRes = await persistQuoteLead({
    fullName: `Phase4A5c Zero ${stamp}`,
    email: `phase4a5c-zero-${stamp}@example.com`,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "Unmatched Exotic Widget Repair",
    description: "Odd request",
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  const zeroLead = await getLeadById(zeroLeadRes.leadId);
  const zeroRet = await retrieveApprovedPlaybookForLead(zeroLead);
  // May still match '*' entries like internal was approved with * but excluded by sensitivity.
  // Create no '*' lead_qualification validated approved except we may have retired ones.
  // Our validated TV rule is tv-mounting only; internal is * but sensitivity excluded.
  // hypothesis/discussion never approved. So zero match expected for exotic project.
  check("zero_match_ok", zeroRet.entries.length === 0);

  // --- Lead Agent context + fingerprint ---
  const packed = await buildLeadAgentContext(leadId);
  check("context_ok", !!packed?.userPrompt);
  check(
    "prompt_has_playbook_section",
    packed.userPrompt.includes("MCS PLAYBOOK — APPROVED GUIDANCE")
  );
  check(
    "prompt_keeps_crm_facts",
    packed.userPrompt.includes("TRUSTED CRM FACTS")
  );
  check(
    "fingerprint_includes_revision_ids",
    Array.isArray(packed.playbookRevisionIds) &&
      packed.playbookRevisionIds.includes(draft2.revision.id)
  );
  const fp1 = packed.fingerprint;

  // Retire current approved → fingerprint should change / retrieval empty of that id
  const retired = await retirePlaybookRevision({
    entryId,
    revisionId: draft2.revision.id,
  });
  check("retire_ok", retired.ok === true, retired.error || "");
  check(
    "retire_clears_pointer",
    retired.entry?.current_approved_revision_id == null
  );

  const afterRetire = await retrieveApprovedPlaybookForLead(lead);
  check(
    "retired_disappears_from_retrieval",
    !afterRetire.revisionIds.includes(draft2.revision.id)
  );

  const packed2 = await buildLeadAgentContext(leadId);
  check(
    "fingerprint_changes_after_retire",
    packed2.fingerprint !== fp1
  );

  // --- 4A.6 feedback cannot mutate playbook ---
  const analysis = await insertLeadAnalysis({
    leadId,
    provider: "test",
    model: "mock",
    promptVersion: LEAD_AGENT_PROMPT_VERSION,
    inputFingerprint: packed2.fingerprint,
    crmNextActionSnapshot: "Review lead",
    analysis: {
      factual_summary: "TV mount lead.",
      missing_information: ["Wall type"],
      questions_to_ask: ["What is the wall type?"],
      risks_and_ambiguities: ["Unknown wall"],
      operational_complexity: "medium",
      complexity_rationale: "Wall unknown.",
      customer_context: { recurrence: "new", relevant_facts: [], owner_tags: [] },
      uncertainties: [],
      suggested_next_action: "Ask wall type",
    },
    createdBy: "test",
  });
  assert(analysis.ok, "insert analysis");
  const fb = await submitLeadAnalysisFeedback({
    leadId,
    analysisId: analysis.analysis.id,
    decision: "corrected",
    correctedSuggestedNextAction: "Ask for wall photos",
    correctionNote: "Should not touch playbook",
  });
  check("feedback_ok", fb.ok === true);
  const [pbCountAfter] = await sql`SELECT COUNT(*)::int AS c FROM playbook_entries`;
  check("feedback_no_playbook_entry_create", pbCountAfter.c === pbCountBefore.c + 7);
  // 7 entries created in this test: validated, hyp, disc, draftonly, unrelated, workproc, internal

  const leadAfter = await getLeadById(leadId);
  check(
    "crm_status_unchanged",
    leadAfter.status === leadBefore.status &&
      String(leadAfter.updated_at) === leadBefore.updated_at
  );

  // --- UI / auth ---
  const unauth = await fetch(`${BASE}/command-center/playbook/${entryId}`, {
    redirect: "manual",
  });
  check(
    "auth_protect_playbook_detail",
    unauth.status === 307 || unauth.status === 302,
    `status=${unauth.status}`
  );

  // Re-approve a new draft for UI checks
  const uiDraft = await createPlaybookDraftRevision({
    entryId,
    summary: "UI approve target",
    bodyMd: "UI body",
    createdBy: "test",
  });
  await updatePlaybookEntryMetadata({
    entryId,
    title: validated.entry.title,
    category: "lead_qualification",
    serviceKeys: ["tv-mounting"],
    tags: ["4a5c"],
    sensitivity: "operational",
    validationState: "validated",
  });
  const cookie = mintOwnerCookie();
  const detail = await fetch(`${BASE}/command-center/playbook/${entryId}`, {
    headers: { cookie },
  });
  const html = await detail.text();
  check("playbook_detail_200", detail.status === 200);
  check(
    "ui_has_approve_for_validated_draft",
    html.includes("Approve for agents")
  );

  // Hypothesis detail should not show Approve for agents as eligible path without validated
  const hypDetail = await fetch(`${BASE}/command-center/playbook/${hyp.entry.id}`, {
    headers: { cookie },
  });
  const hypHtml = await hypDetail.text();
  check(
    "ui_hypothesis_no_approve_button",
    !hypHtml.includes("Approve for agents")
  );
  check(
    "ui_hypothesis_validated_gate_copy",
    hypHtml.includes("Validated MCS rule")
  );

  void uiDraft;

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Phase 4A.5.c summary ---");
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
