#!/usr/bin/env node
/**
 * Phase 5B — Job scheduling + Needs Scheduling + week calendar (Development only).
 *
 * Usage:
 *   node scripts/test-phase5b-scheduling.mjs
 *
 * Uses TEST_DATABASE_URL. Never writes to Production.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import {
  createJobFromLead,
  getJobById,
  getSchedulingDashboardCounts,
  listJobsForCalendarRange,
  listJobsForCustomer,
  listNeedsSchedulingJobs,
  rescheduleJob,
  scheduleJob,
  setJobAssignedWorker,
  unscheduleJob,
  updateJobStatus,
} from "../lib/cc/db/jobs.js";
import { createWorker } from "../lib/cc/db/workers.js";
import { updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  addCalendarDays,
  chicagoToday,
  isValidCalendarDateString,
  mondayWeekContaining,
  normalizeCalendarDateInput,
} from "../lib/cc/domain/chicago-date.js";
import {
  canRescheduleJob,
  canScheduleJob,
  canUnscheduleJob,
  isLegacyNeedsDate,
  isScheduleReadOnly,
  needsScheduling,
} from "../lib/cc/domain/job-scheduling.js";
import { partitionCustomerJobs } from "../lib/cc/domain/customer-jobs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS — ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
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
    fullName: overrides.fullName || `Phase5B ${stamp}`,
    email,
    city: overrides.city || "Manvel",
    propertyType: "Residential",
    projectType: overrides.projectType || "TV Mounting",
    description: overrides.description || `Phase 5B scheduling test ${stamp}`,
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  assert(persisted.ok && persisted.leadId, "persist lead");
  await advanceLeadToAccepted(persisted.leadId);
  return persisted;
}

async function createAuthorizedJob(email, overrides = {}) {
  const lead = await createAcceptedLead(email, overrides);
  const job = await createJobFromLead({ leadId: lead.leadId });
  assert(job.ok && job.created && job.job?.id, "create job");
  return { lead, job: job.job };
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused production host");

  const sql = neon(process.env.DATABASE_URL);
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;

  // --- Migration 013 present on DEV ---
  const [mig] = await sql`
    SELECT id FROM schema_migrations WHERE id = '013_job_scheduling.sql'
  `;
  check("dev_migration_013_present", Boolean(mig?.id));

  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name IN ('scheduled_date', 'scheduled_window')
    ORDER BY column_name
  `;
  check(
    "dev_schedule_columns_present",
    cols.length === 2 &&
      cols.some((c) => c.column_name === "scheduled_date") &&
      cols.some((c) => c.column_name === "scheduled_window")
  );

  // --- Civil date / timezone helpers ---
  check("ymd_valid_accepts", isValidCalendarDateString("2026-09-21"));
  check("ymd_rejects_invalid", !isValidCalendarDateString("2026-02-30"));
  check(
    "normalize_rejects_empty",
    normalizeCalendarDateInput("") === null &&
      normalizeCalendarDateInput(null) === null
  );
  const todayChi = chicagoToday();
  check("chicago_today_ymd", isValidCalendarDateString(todayChi), todayChi);
  const tomorrowChi = addCalendarDays(todayChi, 1);
  check("chicago_tomorrow_ymd", isValidCalendarDateString(tomorrowChi), tomorrowChi);
  // UTC midnight of YYYY-MM-DD must not shift the civil day when stored as date string
  check(
    "no_utc_shift_on_ymd_string",
    normalizeCalendarDateInput("2026-03-08") === "2026-03-08"
  );
  const week = mondayWeekContaining("2026-09-23"); // Wednesday
  check("week_starts_monday", week.weekStart === "2026-09-21", week.weekStart);
  check("week_ends_sunday", week.weekEnd === "2026-09-27", week.weekEnd);
  check("week_has_7_days", week.days.length === 7);

  // --- Domain predicates ---
  check(
    "needs_scheduling_authorized_null",
    needsScheduling({ status: "authorized", scheduled_date: null })
  );
  check(
    "needs_scheduling_legacy_scheduled_null",
    needsScheduling({ status: "scheduled", scheduled_date: null })
  );
  check(
    "not_needs_scheduling_when_dated",
    !needsScheduling({ status: "scheduled", scheduled_date: "2026-09-21" })
  );
  check(
    "legacy_needs_date",
    isLegacyNeedsDate({ status: "scheduled", scheduled_date: null })
  );
  check(
    "can_schedule_authorized",
    canScheduleJob({ status: "authorized", scheduled_date: null })
  );
  check(
    "can_reschedule_only_scheduled_with_date",
    canRescheduleJob({ status: "scheduled", scheduled_date: "2026-09-21" }) &&
      !canRescheduleJob({ status: "scheduled", scheduled_date: null }) &&
      !canRescheduleJob({ status: "in_progress", scheduled_date: "2026-09-21" })
  );
  check(
    "schedule_read_only_terminal_active",
    isScheduleReadOnly({ status: "in_progress" }) &&
      isScheduleReadOnly({ status: "completed" }) &&
      isScheduleReadOnly({ status: "cancelled" }) &&
      !isScheduleReadOnly({ status: "scheduled", scheduled_date: "2026-09-21" })
  );

  // --- Source contracts ---
  const migSql = readFileSync(
    join(ROOT, "lib/cc/db/migrations/013_job_scheduling.sql"),
    "utf8"
  );
  check(
    "migration_no_status_date_check",
    !/ADD CONSTRAINT[\s\S]*scheduled_date\s+IS\s+NOT\s+NULL/i.test(migSql) &&
      /Does NOT enforce status='scheduled'/i.test(migSql)
  );
  const calendarSrc = readFileSync(
    join(ROOT, "app/command-center/calendar/page.js"),
    "utf8"
  );
  check(
    "calendar_page_owner_and_week",
    /requireOwner/.test(calendarSrc) &&
      /mondayWeekContaining/.test(calendarSrc) &&
      /listJobsForCalendarRange/.test(calendarSrc) &&
      /listNeedsSchedulingJobs/.test(calendarSrc)
  );
  check(
    "calendar_no_drag_drop",
    !/ondrag|draggable|drag.?drop/i.test(calendarSrc)
  );

  // --- Authorized + null = Needs Scheduling ---
  const emailAuth = `phase5b-auth-${stamp}@example.com`;
  const { job: authJob } = await createAuthorizedJob(emailAuth, {
    fullName: `Phase5B Auth ${stamp}`,
  });
  check("authorized_null_date", authJob.status === "authorized" && !authJob.scheduled_date);
  check("authorized_needs_scheduling_domain", needsScheduling(authJob));

  const needsBefore = await listNeedsSchedulingJobs({ limit: 200 });
  check(
    "authorized_in_needs_queue",
    needsBefore.some((j) => j.id === authJob.id)
  );

  const dashBefore = await getSchedulingDashboardCounts({
    today: todayChi,
    tomorrow: tomorrowChi,
  });
  check("dashboard_needs_includes_authorized", dashBefore.needsScheduling >= 1);

  // --- Initial schedule (default flex) ---
  const schedDate = "2026-09-22";
  const scheduled = await scheduleJob({
    jobId: authJob.id,
    scheduledDate: schedDate,
    // omit window → default flex
  });
  check("initial_schedule_ok", scheduled.ok === true, scheduled.error);
  check("initial_status_scheduled", scheduled.job?.status === "scheduled");
  check("initial_date_set", scheduled.job?.scheduled_date === schedDate);
  check("default_flex", scheduled.job?.scheduled_window === "flex");
  check(
    "not_in_needs_after_schedule",
    !(await listNeedsSchedulingJobs({ limit: 200 })).some((j) => j.id === authJob.id)
  );

  // --- Explicit am ---
  const { job: amJob } = await createAuthorizedJob(`phase5b-am-${stamp}@example.com`);
  const amSched = await scheduleJob({
    jobId: amJob.id,
    scheduledDate: "2026-09-23",
    scheduledWindow: "am",
  });
  check("explicit_am", amSched.ok && amSched.job?.scheduled_window === "am");

  // --- Explicit pm ---
  const { job: pmJob } = await createAuthorizedJob(`phase5b-pm-${stamp}@example.com`);
  const pmSched = await scheduleJob({
    jobId: pmJob.id,
    scheduledDate: "2026-09-24",
    scheduledWindow: "pm",
  });
  check("explicit_pm", pmSched.ok && pmSched.job?.scheduled_window === "pm");

  // --- Legacy scheduled + null preserved + can receive date ---
  const { job: legacySeed } = await createAuthorizedJob(
    `phase5b-legacy-${stamp}@example.com`
  );
  // Simulate legacy: scheduled with null date (bypass scheduleJob)
  await sql`
    UPDATE jobs
    SET status = 'scheduled', scheduled_date = NULL, scheduled_window = NULL
    WHERE id = ${legacySeed.id}
  `;
  const legacy = await getJobById(legacySeed.id);
  check(
    "legacy_scheduled_null_preserved",
    legacy?.status === "scheduled" &&
      legacy?.scheduled_date === null &&
      legacy?.scheduled_window === null
  );
  check("legacy_needs_date_badge", isLegacyNeedsDate(legacy));
  check(
    "legacy_in_needs_queue",
    (await listNeedsSchedulingJobs({ limit: 200 })).some((j) => j.id === legacy.id)
  );
  check(
    "legacy_not_on_calendar_until_dated",
    !(
      await listJobsForCalendarRange({
        weekStart: "2026-09-21",
        weekEnd: "2026-09-27",
      })
    ).some((j) => j.id === legacy.id)
  );

  const legacyDated = await scheduleJob({
    jobId: legacy.id,
    scheduledDate: "2026-09-25",
    scheduledWindow: "am",
  });
  check(
    "legacy_can_receive_date",
    legacyDated.ok &&
      legacyDated.job?.status === "scheduled" &&
      legacyDated.job?.scheduled_date === "2026-09-25" &&
      legacyDated.job?.scheduled_window === "am",
    legacyDated.error
  );
  // job_scheduled (not a fake transition) for legacy first date
  const [legacyAct] = await sql`
    SELECT event_type, meta
    FROM activity_log
    WHERE lead_id = ${legacy.lead_id}
      AND event_type = 'job_scheduled'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  check(
    "legacy_first_date_is_job_scheduled",
    legacyAct?.event_type === "job_scheduled" &&
      (legacyAct.meta?.toDate === "2026-09-25" ||
        legacyAct.meta?.todate === "2026-09-25" ||
        String(JSON.stringify(legacyAct.meta)).includes("2026-09-25"))
  );

  // --- Worker assignment unchanged by schedule ---
  const worker = await createWorker({ displayName: `Phase5B Worker ${stamp}` });
  assert(worker.ok && worker.worker?.id, "create worker");
  const { job: assignJob } = await createAuthorizedJob(
    `phase5b-assign-${stamp}@example.com`
  );
  const assigned = await setJobAssignedWorker({
    jobId: assignJob.id,
    workerId: worker.worker.id,
    actor: "owner",
  });
  assert(assigned.ok, "assign worker");
  const afterSchedAssign = await scheduleJob({
    jobId: assignJob.id,
    scheduledDate: "2026-09-22",
    scheduledWindow: "flex",
  });
  check(
    "worker_assignment_unchanged_on_schedule",
    afterSchedAssign.ok &&
      afterSchedAssign.job?.assigned_worker_id === worker.worker.id
  );

  // --- Reschedule scheduled job ---
  const resched = await rescheduleJob({
    jobId: assignJob.id,
    scheduledDate: "2026-09-26",
    scheduledWindow: "pm",
  });
  check(
    "reschedule_scheduled_ok",
    resched.ok &&
      resched.job?.status === "scheduled" &&
      resched.job?.scheduled_date === "2026-09-26" &&
      resched.job?.scheduled_window === "pm" &&
      resched.job?.assigned_worker_id === worker.worker.id,
    resched.error
  );

  // --- Reschedule rejected for in_progress / completed / cancelled ---
  const { job: ipJob } = await createAuthorizedJob(`phase5b-ip-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: ipJob.id,
        scheduledDate: "2026-09-22",
        scheduledWindow: "am",
      })
    ).ok
  );
  assert((await updateJobStatus({ jobId: ipJob.id, nextStatus: "in_progress" })).ok);
  const ipAfter = await getJobById(ipJob.id);
  check(
    "scheduled_to_in_progress_retains_date_window",
    ipAfter?.status === "in_progress" &&
      ipAfter?.scheduled_date === "2026-09-22" &&
      ipAfter?.scheduled_window === "am"
  );
  const ipResched = await rescheduleJob({
    jobId: ipJob.id,
    scheduledDate: "2026-09-28",
    scheduledWindow: "pm",
  });
  check(
    "reschedule_in_progress_rejected",
    ipResched.ok === false && ipResched.error === "schedule_read_only"
  );
  const ipSched = await scheduleJob({
    jobId: ipJob.id,
    scheduledDate: "2026-09-28",
    scheduledWindow: "pm",
  });
  check(
    "schedule_edit_in_progress_rejected",
    ipSched.ok === false && ipSched.error === "schedule_read_only"
  );

  assert((await updateJobStatus({ jobId: ipJob.id, nextStatus: "completed" })).ok);
  const completed = await getJobById(ipJob.id);
  check(
    "in_progress_to_completed_retains_date_window",
    completed?.status === "completed" &&
      completed?.scheduled_date === "2026-09-22" &&
      completed?.scheduled_window === "am"
  );
  const completedResched = await rescheduleJob({
    jobId: ipJob.id,
    scheduledDate: "2026-09-28",
    scheduledWindow: "flex",
  });
  check(
    "reschedule_completed_rejected",
    completedResched.ok === false && completedResched.error === "schedule_read_only"
  );

  const { job: cancelJob } = await createAuthorizedJob(
    `phase5b-cancel-${stamp}@example.com`
  );
  assert(
    (
      await scheduleJob({
        jobId: cancelJob.id,
        scheduledDate: "2026-09-23",
        scheduledWindow: "pm",
      })
    ).ok
  );
  assert((await updateJobStatus({ jobId: cancelJob.id, nextStatus: "cancelled" })).ok);
  const cancelled = await getJobById(cancelJob.id);
  check(
    "cancelled_retains_date_window",
    cancelled?.status === "cancelled" &&
      cancelled?.scheduled_date === "2026-09-23" &&
      cancelled?.scheduled_window === "pm"
  );
  const cancelResched = await rescheduleJob({
    jobId: cancelJob.id,
    scheduledDate: "2026-09-29",
    scheduledWindow: "am",
  });
  check(
    "reschedule_cancelled_rejected",
    cancelResched.ok === false && cancelResched.error === "schedule_read_only"
  );

  // --- Unschedule ---
  const { job: unJob } = await createAuthorizedJob(`phase5b-un-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: unJob.id,
        scheduledDate: "2026-09-24",
        scheduledWindow: "flex",
      })
    ).ok
  );
  const worker2 = await createWorker({ displayName: `Phase5B W2 ${stamp}` });
  assert(worker2.ok);
  assert(
    (
      await setJobAssignedWorker({
        jobId: unJob.id,
        workerId: worker2.worker.id,
      })
    ).ok
  );
  const unscheduled = await unscheduleJob({ jobId: unJob.id });
  check(
    "unschedule_ok",
    unscheduled.ok &&
      unscheduled.job?.status === "authorized" &&
      unscheduled.job?.scheduled_date === null &&
      unscheduled.job?.scheduled_window === null &&
      unscheduled.job?.assigned_worker_id === worker2.worker.id,
    unscheduled.error
  );
  check("can_unschedule_predicate", canUnscheduleJob({
    status: "scheduled",
    scheduled_date: "2026-09-24",
  }));

  // Generic status form must not clear schedule via authorized↔scheduled
  const blockAuthSched = await updateJobStatus({
    jobId: unJob.id,
    nextStatus: "scheduled",
  });
  check(
    "status_form_blocks_authorized_to_scheduled",
    blockAuthSched.ok === false && blockAuthSched.error === "use_schedule_action"
  );

  // --- Calendar week range + filters ---
  const calWeek = await listJobsForCalendarRange({
    weekStart: "2026-09-21",
    weekEnd: "2026-09-27",
  });
  check(
    "calendar_week_range_includes_dated",
    calWeek.some((j) => j.id === assignJob.id) &&
      calWeek.every(
        (j) =>
          j.scheduled_date >= "2026-09-21" && j.scheduled_date <= "2026-09-27"
      )
  );
  check(
    "calendar_excludes_null_date",
    !calWeek.some((j) => !j.scheduled_date)
  );

  const byWorker = await listJobsForCalendarRange({
    weekStart: "2026-09-21",
    weekEnd: "2026-09-27",
    workerId: worker.worker.id,
  });
  check(
    "calendar_worker_filter",
    byWorker.length >= 1 &&
      byWorker.every((j) => j.assigned_worker_id === worker.worker.id) &&
      byWorker.some((j) => j.id === assignJob.id)
  );

  // Create an unassigned dated job for filter
  const { job: unasJob } = await createAuthorizedJob(
    `phase5b-unas-${stamp}@example.com`
  );
  assert(
    (
      await scheduleJob({
        jobId: unasJob.id,
        scheduledDate: "2026-09-21",
        scheduledWindow: "am",
      })
    ).ok
  );
  const unasOnly = await listJobsForCalendarRange({
    weekStart: "2026-09-21",
    weekEnd: "2026-09-27",
    workerId: "unassigned",
  });
  check(
    "calendar_unassigned_filter",
    unasOnly.some((j) => j.id === unasJob.id) &&
      unasOnly.every((j) => j.assigned_worker_id == null)
  );

  const byStatus = await listJobsForCalendarRange({
    weekStart: "2026-09-21",
    weekEnd: "2026-09-27",
    status: "scheduled",
  });
  check(
    "calendar_status_filter",
    byStatus.length >= 1 && byStatus.every((j) => j.status === "scheduled")
  );

  // --- Dashboard Jobs Today / Tomorrow ---
  const { job: todayJob } = await createAuthorizedJob(
    `phase5b-today-${stamp}@example.com`
  );
  assert(
    (
      await scheduleJob({
        jobId: todayJob.id,
        scheduledDate: todayChi,
        scheduledWindow: "am",
      })
    ).ok
  );
  const { job: tomJob } = await createAuthorizedJob(
    `phase5b-tom-${stamp}@example.com`
  );
  assert(
    (
      await scheduleJob({
        jobId: tomJob.id,
        scheduledDate: tomorrowChi,
        scheduledWindow: "pm",
      })
    ).ok
  );
  const dashAfter = await getSchedulingDashboardCounts({
    today: todayChi,
    tomorrow: tomorrowChi,
  });
  check("dashboard_jobs_today", dashAfter.jobsToday >= 1);
  check("dashboard_jobs_tomorrow", dashAfter.jobsTomorrow >= 1);
  check("dashboard_needs_scheduling_count", typeof dashAfter.needsScheduling === "number");

  // Re-create authorized null for needs count presence
  const { job: needsAgain } = await createAuthorizedJob(
    `phase5b-needs2-${stamp}@example.com`
  );
  const needsList = await listNeedsSchedulingJobs({ limit: 200 });
  check(
    "needs_queue_has_authorized_null",
    needsList.some((j) => j.id === needsAgain.id && j.status === "authorized")
  );
  // Ordering: oldest authorized_at first
  if (needsList.length >= 2) {
    const times = needsList.map((j) => new Date(j.authorized_at).getTime());
    let ordered = true;
    for (let i = 1; i < times.length; i += 1) {
      if (times[i] < times[i - 1]) ordered = false;
    }
    check("needs_queue_oldest_authorized_first", ordered);
  } else {
    check("needs_queue_oldest_authorized_first", true, "single item");
  }

  // --- Customer Profile ordering ---
  const custEmail = `phase5b-cust-${stamp}@example.com`;
  const leadEarly = await createAcceptedLead(custEmail, {
    fullName: `Phase5B Cust ${stamp}`,
    projectType: "TV Mounting",
  });
  const jobUndated = await createJobFromLead({ leadId: leadEarly.leadId });
  assert(jobUndated.ok);

  const leadMid = await createAcceptedLead(custEmail, {
    fullName: `Phase5B Cust ${stamp}`,
    projectType: "Drywall Repair",
  });
  assert(leadMid.customerId === leadEarly.customerId);
  const jobLaterDate = await createJobFromLead({ leadId: leadMid.leadId });
  assert(jobLaterDate.ok);
  assert(
    (
      await scheduleJob({
        jobId: jobLaterDate.job.id,
        scheduledDate: "2026-10-10",
        scheduledWindow: "am",
      })
    ).ok
  );

  const leadLate = await createAcceptedLead(custEmail, {
    fullName: `Phase5B Cust ${stamp}`,
    projectType: "Furniture Assembly",
  });
  const jobEarlierDate = await createJobFromLead({ leadId: leadLate.leadId });
  assert(jobEarlierDate.ok);
  assert(
    (
      await scheduleJob({
        jobId: jobEarlierDate.job.id,
        scheduledDate: "2026-10-01",
        scheduledWindow: "pm",
      })
    ).ok
  );

  // Legacy needs-date on same customer
  const leadLegacy = await createAcceptedLead(custEmail, {
    fullName: `Phase5B Cust ${stamp}`,
    projectType: "Painting",
  });
  const jobLegacyCust = await createJobFromLead({ leadId: leadLegacy.leadId });
  assert(jobLegacyCust.ok);
  await sql`
    UPDATE jobs
    SET status = 'scheduled', scheduled_date = NULL, scheduled_window = NULL
    WHERE id = ${jobLegacyCust.job.id}
  `;

  const custJobs = await listJobsForCustomer(leadEarly.customerId);
  const { upcoming } = partitionCustomerJobs(custJobs);
  const datedFirst = upcoming.filter((j) => j.scheduled_date);
  const undatedAfter = upcoming.filter((j) => !j.scheduled_date);
  check(
    "customer_profile_dated_before_undated",
    datedFirst.length >= 2 &&
      undatedAfter.length >= 1 &&
      upcoming.findIndex((j) => j.scheduled_date) <
        upcoming.findIndex((j) => !j.scheduled_date)
  );
  check(
    "customer_profile_dated_asc",
    datedFirst[0].scheduled_date <= datedFirst[datedFirst.length - 1].scheduled_date &&
      datedFirst.some((j) => j.scheduled_date === "2026-10-01") &&
      datedFirst.some((j) => j.scheduled_date === "2026-10-10")
  );
  const legacyCustRow = upcoming.find((j) => j.id === jobLegacyCust.job.id);
  check(
    "customer_profile_legacy_needs_date",
    legacyCustRow && isLegacyNeedsDate(legacyCustRow)
  );

  // --- Activity events ---
  const acts = await sql`
    SELECT event_type, meta, message
    FROM activity_log
    WHERE event_type IN ('job_scheduled', 'job_rescheduled', 'job_unscheduled')
      AND (
        meta->>'jobId' = ${authJob.id}
        OR meta->>'jobId' = ${assignJob.id}
        OR meta->>'jobId' = ${unJob.id}
      )
    ORDER BY created_at ASC
  `;
  check(
    "activity_job_scheduled",
    acts.some((a) => a.event_type === "job_scheduled")
  );
  check(
    "activity_job_rescheduled",
    acts.some(
      (a) =>
        a.event_type === "job_rescheduled" &&
        (a.meta?.fromDate || a.meta?.fromdate) &&
        (a.meta?.toDate || a.meta?.todate)
    )
  );
  check(
    "activity_job_unscheduled",
    acts.some((a) => a.event_type === "job_unscheduled")
  );

  // Status form must not clear schedule on cancel from scheduled
  // (already covered) — also verify use_schedule_action blocks unschedule path
  const { job: blockUn } = await createAuthorizedJob(
    `phase5b-blockun-${stamp}@example.com`
  );
  assert(
    (
      await scheduleJob({
        jobId: blockUn.id,
        scheduledDate: "2026-09-22",
        scheduledWindow: "am",
      })
    ).ok
  );
  const blockSchedAuth = await updateJobStatus({
    jobId: blockUn.id,
    nextStatus: "authorized",
  });
  check(
    "status_form_blocks_scheduled_to_authorized",
    blockSchedAuth.ok === false && blockSchedAuth.error === "use_schedule_action"
  );

  console.log(`\nPhase 5B focused tests: ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
