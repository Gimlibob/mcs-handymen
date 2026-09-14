#!/usr/bin/env node
/**
 * Phase 4B.0 — minimum Job operational foundation (no AI).
 *
 * Usage:
 *   node scripts/test-phase4b0-jobs.mjs
 *
 * Requires DATABASE_URL. Optional BASE_URL for auth redirect check.
 */
import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import {
  createJobFromLead,
  getActiveJobForLead,
  getJobById,
  updateJobStatus,
} from "../lib/cc/db/jobs.js";
import { getLeadById, updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  canTransitionJobStatus,
  isLeadEligibleForJobCreate,
  JOB_CREATE_ELIGIBLE_LEAD_STATUSES,
  JOB_STATUSES,
} from "../lib/cc/domain/job-status.js";
import { canTransitionLeadStatus } from "../lib/cc/domain/lead-status.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS — ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function advanceLeadToAccepted(leadId) {
  const path = [
    "waiting_info",
    "ready_for_estimate",
    "estimate_draft",
    "estimate_pending_review",
    "estimate_sent",
    "accepted",
  ];
  for (const next of path) {
    const r = await updateLeadStatus({ leadId, nextStatus: next, actor: "owner" });
    assert(r.ok, `advance to ${next}: ${r.error}`);
  }
}

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  // --- Post-update UI reliability (source contract) ---
  const jobActionsSrc = readFileSync(join(ROOT, "components/cc/JobActions.js"), "utf8");
  const statusFormMatch = jobActionsSrc.match(
    /export function JobStatusChangeForm[\s\S]*?(?=export function|$)/
  );
  const statusFormSrc = statusFormMatch ? statusFormMatch[0] : "";
  check(
    "status_form_uses_full_navigation",
    /window\.location\.assign\(`\/command-center\/jobs\/\$\{jobId\}`\)/.test(statusFormSrc),
    "expected window.location.assign to Job Detail"
  );
  check(
    "status_form_does_not_use_router_refresh",
    statusFormSrc.length > 0 && !/router\.refresh\s*\(/.test(statusFormSrc),
    "JobStatusChangeForm must not call router.refresh()"
  );

  const actionsSrc = readFileSync(join(ROOT, "lib/cc/actions/jobs.js"), "utf8");
  const changeActionMatch = actionsSrc.match(
    /export async function changeJobStatusAction[\s\S]*?(?=export async function|$)/
  );
  const changeActionSrc = changeActionMatch ? changeActionMatch[0] : "";
  check(
    "status_action_returns_slim_payload",
    /ok:\s*true[\s\S]*?jobId:\s*result\.job\.id[\s\S]*?status:\s*result\.job\.status/.test(
      changeActionSrc
    ),
    "changeJobStatusAction should return { ok, jobId, status }"
  );

  // --- Domain rules ---
  check(
    "domain_initial_authorized_only_create_path",
    JOB_STATUSES[0] === "authorized"
  );
  check(
    "domain_eligible_includes_accepted",
    JOB_CREATE_ELIGIBLE_LEAD_STATUSES.includes("accepted")
  );
  check(
    "domain_new_not_eligible",
    isLeadEligibleForJobCreate("new") === false
  );
  check(
    "domain_transition_authorized_to_scheduled",
    canTransitionJobStatus("authorized", "scheduled") === true
  );
  check(
    "domain_transition_authorized_to_completed_invalid",
    canTransitionJobStatus("authorized", "completed") === false
  );
  check(
    "domain_completed_terminal",
    canTransitionJobStatus("completed", "authorized") === false
  );
  check(
    "domain_cancelled_terminal",
    canTransitionJobStatus("cancelled", "scheduled") === false
  );
  check(
    "lead_lifecycle_untouched",
    canTransitionLeadStatus("accepted", "scheduled") === true &&
      canTransitionLeadStatus("new", "accepted") === false
  );

  // --- Schema ---
  const [table] = await sql`
    SELECT to_regclass('public.jobs') AS reg
  `;
  check("schema_jobs_table", table?.reg === "jobs", `reg=${table?.reg}`);

  const uniqueIdx = await sql`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND indexname = 'jobs_one_active_per_lead_uidx'
  `;
  check(
    "schema_one_active_per_lead_unique",
    uniqueIdx.length === 1 && /UNIQUE/i.test(uniqueIdx[0].indexdef),
    uniqueIdx[0]?.indexdef || "missing"
  );

  // --- Seed eligible lead ---
  const stamp = Date.now();
  const originalScope = `Phase4B0 authorized scope ${stamp}`;
  const created = await persistQuoteLead({
    fullName: `Phase4B0 Job ${stamp}`,
    email: `phase4b0-${stamp}@example.com`,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: originalScope,
    preferredDate: null,
    contactMethod: "Email",
    photos: [],
  });
  assert(created?.ok && created.leadId, "persistQuoteLead failed");
  const leadId = created.leadId;

  const leadNew = await getLeadById(leadId);
  assert(leadNew?.customer_id, "lead must have customer_id");
  const customerId = leadNew.customer_id;
  const statusBeforeCreate = leadNew.status;

  // Ineligible while new
  const ineligible = await createJobFromLead({ leadId });
  check(
    "ineligible_status_blocked",
    ineligible.ok === false && ineligible.error === "lead_not_eligible",
    ineligible.error || ""
  );

  await advanceLeadToAccepted(leadId);
  const leadAccepted = await getLeadById(leadId);
  check("lead_advanced_to_accepted", leadAccepted.status === "accepted");

  // Invalid / merged customer blocks Job create
  const stampCust = Date.now();
  const [mergeTarget] = await sql`
    INSERT INTO customers (full_name, email, email_normalized, city)
    VALUES (
      ${`Phase4B0 Merge Target ${stampCust}`},
      ${`phase4b0-merge-${stampCust}@example.com`},
      ${`phase4b0-merge-${stampCust}@example.com`},
      'Manvel'
    )
    RETURNING id
  `;
  await sql`
    UPDATE customers
    SET merged_into_customer_id = ${mergeTarget.id}
    WHERE id = ${customerId}
  `;
  const invalidCustomer = await createJobFromLead({ leadId });
  check(
    "invalid_customer_blocked",
    invalidCustomer.ok === false && invalidCustomer.error === "invalid_customer",
    invalidCustomer.error || ""
  );
  await sql`
    UPDATE customers
    SET merged_into_customer_id = NULL
    WHERE id = ${customerId}
  `;

  // Create Job
  const first = await createJobFromLead({ leadId, createdBy: "owner" });
  check("eligible_create_ok", first.ok === true && first.created === true, first.error || "");
  assert(first.ok && first.job, "job create required for remaining checks");
  const jobId = first.job.id;

  check("initial_status_authorized", first.job.status === "authorized");
  check("job_links_lead", first.job.lead_id === leadId);
  check("job_links_customer", first.job.customer_id === customerId);
  check("snapshot_service_type", first.job.service_type === "TV Mounting");
  check("snapshot_scope", first.job.scope_summary === originalScope);
  check("snapshot_property_type", first.job.property_type === "Residential");
  check("snapshot_service_city", first.job.service_city === "Manvel");
  check("authorized_at_set", Boolean(first.job.authorized_at));
  check("completed_at_null_initially", first.job.completed_at == null);
  check("cancelled_at_null_initially", first.job.cancelled_at == null);

  // Lead status unchanged by Job create
  const leadAfterCreate = await getLeadById(leadId);
  check(
    "job_create_does_not_change_lead_status",
    leadAfterCreate.status === "accepted",
    leadAfterCreate.status
  );

  // Snapshot integrity: mutate Lead description
  const mutated = `MUTATED lead description ${stamp}`;
  await sql`
    UPDATE leads
    SET description = ${mutated}, updated_at = now()
    WHERE id = ${leadId}
  `;
  const jobAfterLeadEdit = await getJobById(jobId);
  check(
    "scope_snapshot_immutable",
    jobAfterLeadEdit.scope_summary === originalScope,
    jobAfterLeadEdit.scope_summary
  );
  const leadMutated = await getLeadById(leadId);
  check("lead_description_did_change", leadMutated.description === mutated);

  // Idempotent duplicate create
  const second = await createJobFromLead({ leadId });
  check(
    "duplicate_create_idempotent",
    second.ok === true && second.created === false && second.job.id === jobId,
    `created=${second.created} id=${second.job?.id}`
  );
  const third = await createJobFromLead({ leadId });
  check(
    "repeated_create_idempotent",
    third.ok === true && third.created === false && third.job.id === jobId
  );

  const [activeCount] = await sql`
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE lead_id = ${leadId}
      AND status <> 'cancelled'
  `;
  check("one_active_job_only", activeCount.c === 1, `count=${activeCount.c}`);

  // Parallel create race (best-effort)
  const parallel = await Promise.all([
    createJobFromLead({ leadId }),
    createJobFromLead({ leadId }),
    createJobFromLead({ leadId }),
  ]);
  check(
    "concurrent_create_idempotent",
    parallel.every((r) => r.ok && r.job.id === jobId)
  );
  const [activeCount2] = await sql`
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE lead_id = ${leadId}
      AND status <> 'cancelled'
  `;
  check("concurrent_still_one_active", activeCount2.c === 1);

  // Status transitions
  const badJump = await updateJobStatus({ jobId, nextStatus: "completed" });
  check(
    "invalid_job_transition_fails",
    badJump.ok === false && badJump.error === "invalid_transition"
  );

  const toScheduled = await updateJobStatus({ jobId, nextStatus: "scheduled" });
  check("transition_to_scheduled", toScheduled.ok === true && toScheduled.job.status === "scheduled");

  const leadDuringJobStatus = await getLeadById(leadId);
  check(
    "job_status_does_not_change_lead_status",
    leadDuringJobStatus.status === "accepted",
    leadDuringJobStatus.status
  );

  const toInProgress = await updateJobStatus({ jobId, nextStatus: "in_progress" });
  check(
    "transition_to_in_progress",
    toInProgress.ok === true && toInProgress.job.status === "in_progress"
  );

  const toCompleted = await updateJobStatus({ jobId, nextStatus: "completed" });
  check(
    "transition_to_completed",
    toCompleted.ok === true && toCompleted.job.status === "completed"
  );
  check("completed_at_set", Boolean(toCompleted.job.completed_at));

  const afterComplete = await updateJobStatus({ jobId, nextStatus: "scheduled" });
  check(
    "completed_is_terminal",
    afterComplete.ok === false && afterComplete.error === "invalid_transition"
  );

  // Cancel path on a second lead
  const stamp2 = Date.now();
  const created2 = await persistQuoteLead({
    fullName: `Phase4B0 Cancel ${stamp2}`,
    email: `phase4b0-cancel-${stamp2}@example.com`,
    city: "Rosharon",
    propertyType: "Residential",
    projectType: "Drywall Repair",
    description: `Cancel path scope ${stamp2}`,
    preferredDate: null,
    contactMethod: "Phone",
    photos: [],
  });
  assert(created2?.ok && created2.leadId, "second lead persist failed");
  await advanceLeadToAccepted(created2.leadId);
  const job2 = await createJobFromLead({ leadId: created2.leadId });
  assert(job2.ok, "second job create failed");
  const cancelled = await updateJobStatus({
    jobId: job2.job.id,
    nextStatus: "cancelled",
  });
  check(
    "transition_to_cancelled",
    cancelled.ok === true && cancelled.job.status === "cancelled"
  );
  check("cancelled_at_set", Boolean(cancelled.job.cancelled_at));
  check(
    "active_job_null_after_cancel",
    (await getActiveJobForLead(created2.leadId)) == null
  );

  // After cancel, a new Job may be created (unique allows non-cancelled)
  const recreated = await createJobFromLead({ leadId: created2.leadId });
  check(
    "recreate_after_cancel_ok",
    recreated.ok === true &&
      recreated.created === true &&
      recreated.job.id !== job2.job.id
  );

  // Lead lifecycle still works independently
  const leadSched = await updateLeadStatus({
    leadId,
    nextStatus: "scheduled",
    actor: "owner",
  });
  check("lead_lifecycle_still_functions", leadSched.ok === true);
  const leadAfterSched = await getLeadById(leadId);
  check("lead_status_scheduled", leadAfterSched.status === "scheduled");
  const jobStillCompleted = await getJobById(jobId);
  check(
    "job_unaffected_by_lead_status",
    jobStillCompleted.status === "completed",
    jobStillCompleted.status
  );

  // Customer relationship intact
  const [cust] = await sql`
    SELECT id, merged_into_customer_id FROM customers WHERE id = ${customerId}
  `;
  check("customer_relationship_intact", cust?.id === customerId && !cust.merged_into_customer_id);

  // Activity logged
  const [jobCreatedEvents] = await sql`
    SELECT COUNT(*)::int AS c
    FROM activity_log
    WHERE lead_id = ${leadId}
      AND event_type = 'job_created'
  `;
  check("activity_job_created", jobCreatedEvents.c >= 1);

  // Auth: Job Detail redirects when unauthenticated
  try {
    const unauth = await fetch(`${BASE}/command-center/jobs/${jobId}`, {
      redirect: "manual",
    });
    const loc = unauth.headers.get("location") || "";
    check(
      "owner_auth_job_detail_redirect",
      [302, 303, 307].includes(unauth.status) && loc.includes("/login"),
      `status=${unauth.status} loc=${loc}`
    );
  } catch (error) {
    check(
      "owner_auth_job_detail_redirect",
      false,
      `fetch failed (is dev server up?): ${error?.message || error}`
    );
  }

  // Unused but keep reference for clarity in report
  void statusBeforeCreate;

  if (failed > 0) {
    console.error(`\nPhase 4B.0 FAILED — ${failed} check(s)`);
    process.exit(1);
  }
  console.log("\nPhase 4B.0 PASS — all checks");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
