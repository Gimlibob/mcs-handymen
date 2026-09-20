#!/usr/bin/env node
/**
 * Phase 5A — Customer Profile + Job History (Development only).
 *
 * Usage:
 *   node scripts/test-phase5a-customer-jobs.mjs
 *
 * Uses TEST_DATABASE_URL. Never writes to Production.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { resolveHttpTestBase } from "./lib/dev-test-server.mjs";
import { mintOwnerTestCookie } from "./lib/mint-owner-test-cookie.mjs";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import {
  createJobFromLead,
  listJobsForCustomer,
  scheduleJob,
  setJobAssignedWorker,
  updateJobStatus,
} from "../lib/cc/db/jobs.js";
import { createWorker } from "../lib/cc/db/workers.js";
import { getCustomerById } from "../lib/cc/db/customers.js";
import { updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  assertJobPartitionCoverage,
  customerJobHistoryLabel,
  isCustomerJobHistory,
  isCustomerJobUpcoming,
  jobDisplayDate,
  partitionCustomerJobs,
  summarizeCustomerJobs,
} from "../lib/cc/domain/customer-jobs.js";
import { getCustomerRecurrence } from "../lib/cc/domain/customer-match.js";
import { JOB_STATUSES } from "../lib/cc/domain/job-status.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const results = [];

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function advanceLeadToAccepted(leadId) {
  for (const next of [
    "waiting_info",
    "ready_for_estimate",
    "estimate_draft",
    "estimate_pending_review",
    "estimate_sent",
    "accepted",
  ]) {
    const r = await updateLeadStatus({ leadId, nextStatus: next, actor: "owner" });
    assert(r.ok, `advance to ${next}: ${r.error}`);
  }
}

async function createAcceptedLead(email, overrides = {}) {
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const persisted = await persistQuoteLead({
    fullName: overrides.fullName || `Phase5A ${stamp}`,
    email,
    city: overrides.city || "Manvel",
    propertyType: "Residential",
    projectType: overrides.projectType || "TV Mounting",
    description: overrides.description || `Phase 5A job history test ${stamp}`,
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  assert(persisted.ok && persisted.leadId, "persist lead");
  await advanceLeadToAccepted(persisted.leadId);
  return persisted;
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused production host");

  const sql = neon(process.env.DATABASE_URL);
  const pageSrc = readFileSync(
    join(__dirname, "..", "app/command-center/customers/[id]/page.js"),
    "utf8"
  );

  // --- Domain contracts ---
  check("upcoming_includes_authorized", isCustomerJobUpcoming("authorized"));
  check("upcoming_includes_scheduled", isCustomerJobUpcoming("scheduled"));
  check("upcoming_includes_in_progress", isCustomerJobUpcoming("in_progress"));
  check("history_includes_completed", isCustomerJobHistory("completed"));
  check("history_includes_cancelled", isCustomerJobHistory("cancelled"));
  check(
    "partition_covers_all_job_statuses",
    JOB_STATUSES.every((s) => assertJobPartitionCoverage(s))
  );
  check("job_history_label_zero", customerJobHistoryLabel(0) === "No job history");
  check("job_history_label_one", customerJobHistoryLabel(1) === "Returning (jobs)");
  check("lead_recurrence_unchanged", getCustomerRecurrence(1) === "new");
  check(
    "display_date_prefers_scheduled_when_present",
    jobDisplayDate({
      status: "authorized",
      authorized_at: "2026-01-01T00:00:00.000Z",
      scheduled_date: "2026-06-15",
    }) === "2026-06-15"
  );
  check(
    "page_lists_jobs_helper",
    /listJobsForCustomer/.test(pageSrc) && /Upcoming jobs/.test(pageSrc)
  );
  check("page_requireOwner", /requireOwner\(\)/.test(pageSrc));
  check("page_no_scheduled_date_column_write", !/scheduled_date\s*=/.test(pageSrc));
  check("no_migration_013_required", !/013_/.test(pageSrc));

  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const emailZero = `phase5a-zero-${stamp}@example.com`;
  const emailMulti = `phase5a-multi-${stamp}@example.com`;

  // --- Zero jobs ---
  const zeroLead = await createAcceptedLead(emailZero, {
    fullName: `Phase5A Zero ${stamp}`,
  });
  const zeroCustomerId = zeroLead.customerId;
  const zeroJobs = await listJobsForCustomer(zeroCustomerId);
  const zeroSummary = summarizeCustomerJobs(zeroJobs);
  const zeroParts = partitionCustomerJobs(zeroJobs);
  check("zero_jobs_list_empty", zeroJobs.length === 0);
  check("zero_total", zeroSummary.totalJobs === 0);
  check("zero_completed", zeroSummary.completedJobs === 0);
  check("zero_upcoming", zeroSummary.upcomingJobs === 0);
  check("zero_first_null", zeroSummary.firstJobAt === null);
  check("zero_upcoming_section_empty", zeroParts.upcoming.length === 0);
  check("zero_history_section_empty", zeroParts.history.length === 0);

  // --- Multi jobs on one customer ---
  const leadA = await createAcceptedLead(emailMulti, {
    fullName: `Phase5A Multi ${stamp}`,
    projectType: "TV Mounting",
    description: "First job scope for Phase 5A",
  });
  const customerId = leadA.customerId;
  const jobA = await createJobFromLead({ leadId: leadA.leadId });
  assert(jobA.ok && jobA.created, "create job A");

  const leadB = await createAcceptedLead(emailMulti, {
    fullName: `Phase5A Multi ${stamp}`,
    projectType: "Drywall Repair",
    description: "Second job scope for Phase 5A",
    city: "Alvin",
  });
  assert(leadB.customerId === customerId, "same customer for multi leads");
  const jobB = await createJobFromLead({ leadId: leadB.leadId });
  assert(jobB.ok && jobB.created, "create job B");

  const leadC = await createAcceptedLead(emailMulti, {
    fullName: `Phase5A Multi ${stamp}`,
    projectType: "Furniture Assembly",
    description: "Third job cancelled for Phase 5A",
  });
  assert(leadC.customerId === customerId, "same customer for lead C");
  const jobC = await createJobFromLead({ leadId: leadC.leadId });
  assert(jobC.ok && jobC.created, "create job C");

  // Assign worker on job A
  const worker = await createWorker({
    displayName: `Phase5A Worker ${stamp}`,
  });
  assert(worker.ok && worker.worker?.id, "create worker");
  const assigned = await setJobAssignedWorker({
    jobId: jobA.job.id,
    workerId: worker.worker.id,
    actor: "owner",
  });
  assert(assigned.ok, "assign worker");

  // Complete job B: schedule then in_progress → completed
  assert(
    (
      await scheduleJob({
        jobId: jobB.job.id,
        scheduledDate: "2026-09-20",
        scheduledWindow: "am",
      })
    ).ok
  );
  assert((await updateJobStatus({ jobId: jobB.job.id, nextStatus: "in_progress" })).ok);
  assert((await updateJobStatus({ jobId: jobB.job.id, nextStatus: "completed" })).ok);

  // Cancel job C
  assert((await updateJobStatus({ jobId: jobC.job.id, nextStatus: "cancelled" })).ok);

  const allJobs = await listJobsForCustomer(customerId);
  const ids = allJobs.map((j) => j.id);
  check("multi_job_count", allJobs.length === 3, `count=${allJobs.length}`);
  check("no_duplicate_jobs", new Set(ids).size === ids.length);

  const summary = summarizeCustomerJobs(allJobs);
  check("total_jobs_3", summary.totalJobs === 3);
  check("completed_jobs_1", summary.completedJobs === 1);
  check("upcoming_jobs_1", summary.upcomingJobs === 1, `upcoming=${summary.upcomingJobs}`);
  check("first_job_set", Boolean(summary.firstJobAt));
  check("last_job_set", Boolean(summary.lastJobAt));

  const { upcoming, history } = partitionCustomerJobs(allJobs);
  check("upcoming_one_authorized", upcoming.length === 1 && upcoming[0].id === jobA.job.id);
  check(
    "history_has_completed_and_cancelled",
    history.length === 2 &&
      history.some((j) => j.status === "completed") &&
      history.some((j) => j.status === "cancelled")
  );
  check(
    "partition_no_overlap",
    upcoming.every((u) => !history.some((h) => h.id === u.id))
  );

  const withWorker = allJobs.find((j) => j.id === jobA.job.id);
  check(
    "assigned_worker_display",
    withWorker?.assigned_worker_name === worker.worker.display_name,
    `name=${withWorker?.assigned_worker_name}`
  );

  const completed = allJobs.find((j) => j.id === jobB.job.id);
  check("completed_at_set", Boolean(completed?.completed_at));
  // Phase 5B: scheduled_date wins when present (including completed Jobs).
  check(
    "display_date_completed_prefers_scheduled_date",
    completed?.scheduled_date
      ? jobDisplayDate(completed) === completed.scheduled_date
      : jobDisplayDate(completed) === completed.completed_at ||
          new Date(jobDisplayDate(completed)).getTime() ===
            new Date(completed.completed_at).getTime()
  );

  // Merged / invalid customer: list returns empty for unknown id
  const fakeId = "00000000-0000-4000-8000-000000000099";
  const missing = await listJobsForCustomer(fakeId);
  check("unknown_customer_empty_jobs", missing.length === 0);
  const realCustomer = await getCustomerById(customerId);
  check("customer_not_merged", realCustomer && !realCustomer.merged_into_customer_id);

  // HTTP: customer detail shows jobs + link
  const BASE = await resolveHttpTestBase();
  const cookie = await mintOwnerTestCookie();
  const unauth = await fetch(`${BASE}/command-center/customers/${customerId}`, {
    redirect: "manual",
  });
  check(
    "customer_detail_requires_owner",
    unauth.status === 307 || unauth.status === 302,
    `status=${unauth.status}`
  );

  const auth = await fetch(`${BASE}/command-center/customers/${customerId}`, {
    headers: { cookie },
    redirect: "manual",
  });
  check("customer_detail_200", auth.status === 200, `status=${auth.status}`);
  const html = await auth.text();
  check("ui_has_upcoming_section", /Upcoming jobs/i.test(html));
  check("ui_has_history_section", /Job history/i.test(html));
  check("ui_job_summary_total", />\s*3\s*</.test(html) || html.includes(">3<"));
  check(
    "ui_job_detail_link",
    html.includes(`/command-center/jobs/${jobA.job.id}`)
  );
  check("ui_worker_name", html.includes(worker.worker.display_name));
  check("ui_notes_preserved", /Private customer notes/i.test(html));
  check("ui_tags_preserved", /Operational tags/i.test(html));
  check("ui_related_leads", /Related leads/i.test(html));

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhase 5A: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("Phase 5A: PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
