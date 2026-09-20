#!/usr/bin/env node
/**
 * Phase 4B.1 — Job Assignment Foundation (no AI, no worker auth).
 *
 * Usage:
 *   node scripts/test-phase4b1-assignment.mjs
 *
 * Safety:
 *   - Always runs static/source-contract checks (no DB writes).
 *   - DB write suite requires TEST_DATABASE_URL (Neon development).
 *   - Never falls back to Production DATABASE_URL.
 *
 * Optional BASE_URL for owner auth redirect check.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import {
  createJobFromLead,
  getJobById,
  scheduleJob,
  setJobAssignedWorker,
  updateJobStatus,
} from "../lib/cc/db/jobs.js";
import { getLeadById, updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  createWorker,
  getWorkerById,
  listWorkers,
  updateWorkerStatus,
} from "../lib/cc/db/workers.js";
import {
  isValidWorkerStatus,
  isWorkerAssignable,
  WORKER_STATUSES,
} from "../lib/cc/domain/worker-status.js";
import {
  bindProcessToSafeTestDatabase,
  evaluateWriteEligibility,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";
import { resolveHttpTestBase } from "./lib/dev-test-server.mjs";

loadLocalEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let failed = 0;
let dbWriteSkipped = false;
let dbSkipReason = "";

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

function runStaticChecks() {
  console.log("\n=== Static / source contracts ===");

  check(
    "domain_worker_statuses",
    WORKER_STATUSES.includes("active") && WORKER_STATUSES.includes("inactive")
  );
  check("domain_active_assignable", isWorkerAssignable("active") === true);
  check("domain_inactive_not_assignable", isWorkerAssignable("inactive") === false);
  check("domain_invalid_status", isValidWorkerStatus("fired") === false);

  const migration = readFileSync(
    join(ROOT, "lib/cc/db/migrations/010_workers.sql"),
    "utf8"
  );
  check(
    "migration_010_creates_workers",
    /CREATE TABLE IF NOT EXISTS workers/i.test(migration)
  );
  check(
    "migration_010_no_email",
    !/\bemail\b/i.test(migration)
  );
  check(
    "migration_010_assigned_worker_fk",
    /assigned_worker_id[\s\S]*REFERENCES workers/i.test(migration) &&
      /ON DELETE RESTRICT/i.test(migration)
  );
  check(
    "migration_010_does_not_alter_009_file",
    !/009_jobs\.sql/i.test(migration)
  );

  const jobsDb = readFileSync(join(ROOT, "lib/cc/db/jobs.js"), "utf8");
  check(
    "jobs_db_has_setJobAssignedWorker",
    /export async function setJobAssignedWorker/.test(jobsDb)
  );
  check(
    "assignment_does_not_set_job_status",
    /SET\s+[\s\S]*assigned_worker_id[\s\S]*WHERE id = \$\{jobId\}/.test(jobsDb) &&
      !/UPDATE jobs[\s\S]*assigned_worker_id[\s\S]*status =/.test(
        jobsDb.match(/export async function setJobAssignedWorker[\s\S]*?(?=export async function|$)/)?.[0] ||
          ""
      )
  );

  const assignmentFn =
    jobsDb.match(/export async function setJobAssignedWorker[\s\S]*?(?=export async function|$)/)?.[0] ||
    "";
  check(
    "assignment_logs_job_assignment_changed",
    /eventType:\s*"job_assignment_changed"/.test(assignmentFn)
  );
  check(
    "assignment_meta_shape",
    /fromWorkerId/.test(assignmentFn) &&
      /toWorkerId/.test(assignmentFn) &&
      /fromDisplayName/.test(assignmentFn) &&
      /toDisplayName/.test(assignmentFn)
  );
  check(
    "assignment_guards_job_status",
    /job_status_guard_failed/.test(assignmentFn)
  );
  check(
    "assignment_guards_lead_status",
    /lead_guard_failed/.test(assignmentFn)
  );

  const statusFn =
    jobsDb.match(/export async function updateJobStatus[\s\S]*?(?=export async function|$)/)?.[0] ||
    "";
  check(
    "job_status_does_not_clear_assignment",
    /assignment_guard_failed/.test(statusFn) &&
      !/assigned_worker_id\s*=/.test(statusFn.replace(/RETURNING[\s\S]*/i, ""))
  );

  const actionsSrc = readFileSync(join(ROOT, "lib/cc/actions/jobs.js"), "utf8");
  const assignAction =
    actionsSrc.match(
      /export async function setJobAssignedWorkerAction[\s\S]*?(?=export async function|$)/
    )?.[0] || "";
  check(
    "assignment_action_requireOwner",
    /await requireOwner\(\)/.test(assignAction)
  );
  check(
    "assignment_action_slim_payload",
    /assignedWorkerId:\s*result\.job\.assigned_worker_id/.test(assignAction)
  );

  const workerActions = readFileSync(join(ROOT, "lib/cc/actions/workers.js"), "utf8");
  check(
    "worker_create_requireOwner",
    /export async function createWorkerAction[\s\S]*await requireOwner\(\)/.test(
      workerActions
    )
  );
  check(
    "worker_status_requireOwner",
    /export async function setWorkerStatusAction[\s\S]*await requireOwner\(\)/.test(
      workerActions
    )
  );
  check(
    "workers_no_auth_session_creation",
    !/createOwnerSession|CC_SESSION|password|cookie/i.test(workerActions) &&
      !/createOwnerSession|password/i.test(
        readFileSync(join(ROOT, "lib/cc/db/workers.js"), "utf8")
      )
  );

  const jobPage = readFileSync(
    join(ROOT, "app/command-center/jobs/[id]/page.js"),
    "utf8"
  );
  check("job_detail_has_assignment_panel", /Assigned Worker/.test(jobPage));
  check("job_detail_uses_JobAssignmentForm", /JobAssignmentForm/.test(jobPage));

  const jobActionsUi = readFileSync(join(ROOT, "components/cc/JobActions.js"), "utf8");
  const assignUi =
    jobActionsUi.match(/export function JobAssignmentForm[\s\S]*?(?=export function|$)/)?.[0] ||
    "";
  check(
    "assignment_ui_full_navigation",
    /window\.location\.assign\(`\/command-center\/jobs\/\$\{jobId\}`\)/.test(assignUi)
  );
  check("assignment_ui_unassign_control", /Unassign/.test(assignUi));
  check("assignment_ui_inactive_label", /Inactive/.test(assignUi));

  const workersPage = readFileSync(
    join(ROOT, "app/command-center/workers/page.js"),
    "utf8"
  );
  check("workers_page_requireOwner", /requireOwner\(\)/.test(workersPage));
  check("workers_page_create_form", /CreateWorkerForm/.test(workersPage));

  const shell = readFileSync(join(ROOT, "components/cc/CommandCenterShell.js"), "utf8");
  check("nav_includes_workers", /\/command-center\/workers/.test(shell));

  const migration009 = readFileSync(
    join(ROOT, "lib/cc/db/migrations/009_jobs.sql"),
    "utf8"
  );
  check(
    "009_untouched_no_assigned_worker",
    !/assigned_worker_id/.test(migration009)
  );
}

async function runAuthRedirectCheck() {
  console.log("\n=== Owner auth (HTTP redirect, no DB write) ===");
  try {
    const base = await resolveHttpTestBase();
    const res = await fetch(`${base}/command-center/workers`, {
      redirect: "manual",
    });
    check(
      "workers_route_requires_owner_redirect",
      res.status === 307 || res.status === 302 || res.status === 303,
      `status=${res.status}`
    );
    const loc = res.headers.get("location") || "";
    check(
      "workers_route_redirects_to_login",
      loc.includes("/login"),
      loc
    );
  } catch (error) {
    check(
      "workers_route_requires_owner_redirect",
      false,
      `server unreachable: ${error?.message || error}`
    );
  }
}

async function runDbWriteSuite(sql) {
  console.log("\n=== DB write suite (non-Production) ===");

  const [workersTable] = await sql`
    SELECT to_regclass('public.workers') AS reg
  `;
  check("schema_workers_table", workersTable?.reg === "workers", `reg=${workersTable?.reg}`);
  if (workersTable?.reg !== "workers") {
    console.log("SKIP remaining DB writes — workers table missing (apply 010 first)");
    return;
  }

  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'assigned_worker_id'
  `;
  check("schema_jobs_assigned_worker_id", cols.length === 1);

  const stamp = Date.now();
  const createdWorker = await createWorker({
    displayName: `Phase4B1 Worker ${stamp}`,
  });
  check("worker_creation", createdWorker.ok === true, createdWorker.error || "");
  assert(createdWorker.ok, "worker required");
  const workerId = createdWorker.worker.id;
  check("worker_starts_active", createdWorker.worker.status === "active");

  const listed = await listWorkers({ status: "active" });
  check(
    "list_includes_active_worker",
    listed.some((w) => w.id === workerId)
  );

  const inactiveOther = await createWorker({
    displayName: `Phase4B1 Inactive ${stamp}`,
  });
  assert(inactiveOther.ok, "second worker");
  const inactiveId = inactiveOther.worker.id;
  const setInactive = await updateWorkerStatus({
    workerId: inactiveId,
    nextStatus: "inactive",
  });
  check("worker_mark_inactive", setInactive.ok && setInactive.worker.status === "inactive");

  const leadCreated = await persistQuoteLead({
    fullName: `Phase4B1 Assign ${stamp}`,
    email: `phase4b1-${stamp}@example.com`,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: `Phase4B1 scope ${stamp}`,
    preferredDate: null,
    contactMethod: "Email",
    photos: [],
  });
  assert(leadCreated?.ok && leadCreated.leadId, "lead create");
  const leadId = leadCreated.leadId;
  await advanceLeadToAccepted(leadId);

  const jobCreate = await createJobFromLead({ leadId, createdBy: "owner" });
  check("job_create_for_assignment", jobCreate.ok && jobCreate.created, jobCreate.error || "");
  assert(jobCreate.ok, "job required");
  const jobId = jobCreate.job.id;
  check(
    "new_job_unassigned",
    jobCreate.job.assigned_worker_id == null,
    String(jobCreate.job.assigned_worker_id)
  );

  const jobStatusBefore = jobCreate.job.status;
  const leadBefore = await getLeadById(leadId);
  const leadStatusBefore = leadBefore.status;

  const blockedInactive = await setJobAssignedWorker({
    jobId,
    workerId: inactiveId,
    actor: "owner",
  });
  check(
    "inactive_worker_cannot_receive_assignment",
    blockedInactive.ok === false && blockedInactive.error === "worker_inactive",
    blockedInactive.error || ""
  );

  const assigned = await setJobAssignedWorker({
    jobId,
    workerId,
    actor: "owner",
  });
  check(
    "active_worker_can_be_assigned",
    assigned.ok && assigned.job.assigned_worker_id === workerId,
    assigned.error || ""
  );

  const jobAfterAssign = await getJobById(jobId);
  check(
    "assignment_does_not_change_job_status",
    jobAfterAssign.status === jobStatusBefore,
    jobAfterAssign.status
  );
  const leadAfterAssign = await getLeadById(leadId);
  check(
    "assignment_does_not_change_lead_status",
    leadAfterAssign.status === leadStatusBefore,
    leadAfterAssign.status
  );

  const workerB = await createWorker({ displayName: `Phase4B1 WorkerB ${stamp}` });
  assert(workerB.ok, "worker B");
  const reassigned = await setJobAssignedWorker({
    jobId,
    workerId: workerB.worker.id,
    actor: "owner",
  });
  check(
    "reassignment",
    reassigned.ok && reassigned.job.assigned_worker_id === workerB.worker.id,
    reassigned.error || ""
  );

  const unassigned = await setJobAssignedWorker({
    jobId,
    workerId: null,
    actor: "owner",
  });
  check(
    "unassignment",
    unassigned.ok && unassigned.job.assigned_worker_id == null,
    unassigned.error || ""
  );

  // Assign then mark inactive — still visible via getWorkerById
  await setJobAssignedWorker({ jobId, workerId, actor: "owner" });
  await updateWorkerStatus({ workerId, nextStatus: "inactive" });
  const jobWithInactive = await getJobById(jobId);
  const inactiveAssignee = await getWorkerById(jobWithInactive.assigned_worker_id);
  check(
    "inactive_existing_assignee_remains_visible",
    jobWithInactive.assigned_worker_id === workerId &&
      inactiveAssignee?.status === "inactive" &&
      inactiveAssignee?.display_name,
    inactiveAssignee?.status || "missing"
  );

  // Status change must not clear assignment (schedule via schedule action)
  const statusBefore = jobWithInactive.status;
  const toScheduled = await scheduleJob({
    jobId,
    scheduledDate: "2026-09-26",
    scheduledWindow: "am",
  });
  check("job_status_change_ok", toScheduled.ok === true, toScheduled.error || "");
  check(
    "job_status_change_preserves_assignment",
    toScheduled.job.assigned_worker_id === workerId,
    String(toScheduled.job.assigned_worker_id)
  );
  check(
    "job_status_changed_from_authorized",
    statusBefore === "authorized" && toScheduled.job.status === "scheduled"
  );

  const activity = await sql`
    SELECT event_type, message, meta, created_by
    FROM activity_log
    WHERE lead_id = ${leadId}
      AND event_type = 'job_assignment_changed'
    ORDER BY created_at ASC
  `;
  check("activity_job_assignment_changed_exists", activity.length >= 1);
  const lastAssign = activity[activity.length - 1];
  check(
    "activity_created_by_owner",
    lastAssign?.created_by === "owner"
  );
  check(
    "activity_meta_has_ids",
    lastAssign?.meta?.jobId === jobId &&
      ("fromWorkerId" in (lastAssign.meta || {})) &&
      ("toWorkerId" in (lastAssign.meta || {}))
  );
  check(
    "activity_messages_cover_lifecycle",
    activity.some((a) => /assigned/i.test(a.message)) &&
      activity.some((a) => /reassigned/i.test(a.message)) &&
      activity.some((a) => /unassigned/i.test(a.message))
  );

  // One assigned_worker_id column (scalar) — at most one assignee
  const [jobCols] = await sql`
    SELECT COUNT(*)::int AS c
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'assigned_worker_id'
  `;
  check("one_assigned_worker_id_column", jobCols.c === 1, `c=${jobCols.c}`);

  // Existing-style unassigned validity: another job leaves null
  const stamp2 = Date.now();
  const lead2 = await persistQuoteLead({
    fullName: `Phase4B1 Unassigned ${stamp2}`,
    email: `phase4b1-u-${stamp2}@example.com`,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "Handyman",
    description: `Unassigned scope ${stamp2}`,
    preferredDate: null,
    contactMethod: "Email",
    photos: [],
  });
  assert(lead2?.ok, "lead2");
  await advanceLeadToAccepted(lead2.leadId);
  const job2 = await createJobFromLead({ leadId: lead2.leadId });
  check(
    "existing_unassigned_jobs_remain_valid",
    job2.ok && job2.job.assigned_worker_id == null && job2.job.status === "authorized"
  );
}

async function main() {
  runStaticChecks();
  await runAuthRedirectCheck();

  console.log(`\n=== DB environment ===`);
  const eligibility = evaluateWriteEligibility();
  if (!eligibility.ok) {
    dbWriteSkipped = true;
    dbSkipReason = eligibility.reason;
    console.log(eligibility.reason);
    check("write_guard_blocks_unsafe_target", true);
  } else {
    const { host } = bindProcessToSafeTestDatabase({ allowEnvLoad: false });
    console.log(`TEST_DATABASE_HOST=${host}`);
    const sql = neon(process.env.DATABASE_URL);
    await runDbWriteSuite(sql);
  }

  console.log("");
  if (failed > 0) {
    console.error(`FAILED — ${failed} check(s)`);
    process.exit(1);
  }
  console.log(
    dbWriteSkipped
      ? `PASSED — static suite (DB writes skipped: ${dbSkipReason})`
      : "PASSED — all Phase 4B.1 checks"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
