#!/usr/bin/env node
/**
 * Phase 5B.1 — Month calendar view (Development / read-mostly).
 *
 * Usage:
 *   node scripts/test-phase5b1-month-calendar.mjs
 *
 * DB writes use TEST_DATABASE_URL only. Domain/source checks need no DB.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindProcessToSafeTestDatabase } from "./lib/db-write-safety.mjs";
import { persistQuoteLead } from "../lib/cc/db/persist-quote-lead.js";
import {
  createJobFromLead,
  listJobsForCalendarRange,
  listNeedsSchedulingJobs,
  scheduleJob,
  setJobAssignedWorker,
} from "../lib/cc/db/jobs.js";
import { createWorker } from "../lib/cc/db/workers.js";
import { updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  addCalendarMonths,
  chicagoToday,
  isValidCalendarDateString,
  mondayWeekContaining,
  monthGridContaining,
  monthStartContaining,
  normalizeMonthParam,
} from "../lib/cc/domain/chicago-date.js";
import {
  compareJobsForCalendarDay,
  isLegacyNeedsDate,
  needsScheduling,
  scheduleWindowLabel,
  scheduleWindowSortRank,
} from "../lib/cc/domain/job-scheduling.js";

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

async function createAuthorizedJob(email, overrides = {}) {
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const persisted = await persistQuoteLead({
    fullName: overrides.fullName || `Phase5B1 ${stamp}`,
    email,
    city: overrides.city || "Manvel",
    propertyType: "Residential",
    projectType: overrides.projectType || "TV Mounting",
    description: overrides.description || `Phase 5B.1 month calendar ${stamp}`,
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  assert(persisted.ok && persisted.leadId, "persist lead");
  await advanceLeadToAccepted(persisted.leadId);
  const job = await createJobFromLead({ leadId: persisted.leadId });
  assert(job.ok && job.created && job.job?.id, "create job");
  return job.job;
}

function pageSrc() {
  return readFileSync(join(ROOT, "app/command-center/calendar/page.js"), "utf8");
}

async function main() {
  const src = pageSrc();

  // --- Source / owner / week protection ---
  check("page_requireOwner", /requireOwner\(\)/.test(src));
  check("default_view_is_week", /raw === "month" \? "month" : "week"/.test(src));
  check("no_client_expand", !/useState|useEffect|onClick=\{/.test(src));
  check("no_drag_drop", !/ondrag|draggable|drag.?drop/i.test(src));
  check("no_google_calendar", !/google.?calendar|googleapis|oauth/i.test(src));
  check(
    "month_chip_limit_three",
    /MONTH_CHIP_LIMIT\s*=\s*3/.test(src) || /slice\(0,\s*3\)/.test(src)
  );
  check(
    "overflow_links_to_week",
    /view:\s*"week"/.test(src) && /\+\{overflow\} more/.test(src)
  );
  check(
    "filter_preserves_view_month",
    /name="view"\s+value="month"/.test(src)
  );
  check(
    "week_cards_still_rich",
    /service_city/.test(src) && /assigned_worker_name/.test(src) && /jobStatusLabel/.test(src)
  );
  check(
    "needs_scheduling_panel_present",
    /listNeedsSchedulingJobs/.test(src) && /Needs Scheduling/.test(src)
  );

  // --- Month param normalize ---
  check("normalize_yyyy_mm", normalizeMonthParam("2026-09") === "2026-09-01");
  check(
    "normalize_yyyy_mm_dd",
    normalizeMonthParam("2026-09-15") === "2026-09-01"
  );
  check("normalize_rejects_bad", normalizeMonthParam("2026-13") === null);
  check("normalize_rejects_empty", normalizeMonthParam("") === null);

  // --- Month grid: 35-day (Sep 2026) ---
  const sep = monthGridContaining("2026-09-15");
  check("sep_year_month", sep.year === 2026 && sep.month === 9);
  check("sep_month_start", sep.monthStart === "2026-09-01");
  check("sep_month_end", sep.monthEnd === "2026-09-30");
  check("sep_grid_start_monday", sep.gridStart === "2026-08-31", sep.gridStart);
  check("sep_grid_end_sunday", sep.gridEnd === "2026-10-04", sep.gridEnd);
  check("sep_35_days", sep.days.length === 35, String(sep.days.length));
  check(
    "sep_monday_first",
    new Date(`${sep.gridStart}T00:00:00.000Z`).getUTCDay() === 1
  );
  check(
    "sep_has_adjacent_filler",
    sep.days[0] < sep.monthStart && sep.days[sep.days.length - 1] > sep.monthEnd
  );

  // --- Month grid: 42-day (Mar 2026) ---
  const mar = monthGridContaining("2026-03-01");
  check("mar_42_days", mar.days.length === 42, String(mar.days.length));
  check("mar_grid_start_monday", mar.gridStart === "2026-02-23", mar.gridStart);
  check("mar_grid_end_sunday", mar.gridEnd === "2026-04-05", mar.gridEnd);

  // Outside-month flags (logic)
  const outsideBefore = mar.days.filter((d) => d < mar.monthStart);
  const outsideAfter = mar.days.filter((d) => d > mar.monthEnd);
  check("adjacent_month_days_before", outsideBefore.length > 0);
  check("adjacent_month_days_after", outsideAfter.length > 0);
  check(
    "page_marks_outside_month",
    /data-outside-month/.test(src)
  );

  // --- Navigation ---
  check(
    "prev_month",
    addCalendarMonths("2026-09-01", -1) === "2026-08-01"
  );
  check(
    "next_month",
    addCalendarMonths("2026-09-01", 1) === "2026-10-01"
  );
  check(
    "this_month_chicago",
    monthStartContaining(chicagoToday()) === `${chicagoToday().slice(0, 7)}-01`
  );
  check(
    "year_boundary_prev",
    addCalendarMonths("2026-01-01", -1) === "2025-12-01"
  );

  // --- Window order AM → PM → Flex ---
  check("rank_am", scheduleWindowSortRank("am") === 0);
  check("rank_pm", scheduleWindowSortRank("pm") === 1);
  check("rank_flex", scheduleWindowSortRank("flex") === 2);
  const ordered = [
    { id: "f", scheduled_window: "flex", authorized_at: "2026-01-01T00:00:00.000Z" },
    { id: "a", scheduled_window: "am", authorized_at: "2026-01-02T00:00:00.000Z" },
    { id: "p", scheduled_window: "pm", authorized_at: "2026-01-01T00:00:00.000Z" },
  ].sort(compareJobsForCalendarDay);
  check(
    "compare_am_pm_flex",
    ordered.map((j) => j.scheduled_window).join(",") === "am,pm,flex"
  );
  check("label_am", scheduleWindowLabel("am") === "AM");
  check("label_pm", scheduleWindowLabel("pm") === "PM");
  check("label_flex", scheduleWindowLabel("flex") === "Flex");

  // --- +N more week link helper ---
  const overflowDay = "2026-09-22";
  const overflowWeek = mondayWeekContaining(overflowDay);
  check(
    "overflow_week_contains_day",
    overflowWeek.days.includes(overflowDay) &&
      overflowWeek.weekStart === "2026-09-21"
  );

  // --- Needs scheduling domain unchanged ---
  check(
    "needs_authorized_null",
    needsScheduling({ status: "authorized", scheduled_date: null })
  );
  check(
    "needs_legacy_scheduled_null",
    isLegacyNeedsDate({ status: "scheduled", scheduled_date: null })
  );

  // --- Chicago civil safety ---
  check("chicago_today_ymd", isValidCalendarDateString(chicagoToday()));
  check(
    "no_utc_shift_month_param",
    normalizeMonthParam("2026-03-08") === "2026-03-01"
  );

  // --- DB-backed placement / filters (DEV only) ---
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused production host");

  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const busyDate = "2026-09-22";
  const grid = monthGridContaining("2026-09-01");

  const jobAm = await createAuthorizedJob(`phase5b1-am-${stamp}@example.com`, {
    projectType: "TV Mounting",
  });
  assert(
    (
      await scheduleJob({
        jobId: jobAm.id,
        scheduledDate: busyDate,
        scheduledWindow: "am",
      })
    ).ok
  );

  const jobPm = await createAuthorizedJob(`phase5b1-pm-${stamp}@example.com`, {
    projectType: "Drywall Repair",
  });
  assert(
    (
      await scheduleJob({
        jobId: jobPm.id,
        scheduledDate: busyDate,
        scheduledWindow: "pm",
      })
    ).ok
  );

  const jobFlex = await createAuthorizedJob(`phase5b1-flex-${stamp}@example.com`, {
    projectType: "Furniture Assembly",
  });
  assert(
    (
      await scheduleJob({
        jobId: jobFlex.id,
        scheduledDate: busyDate,
        scheduledWindow: "flex",
      })
    ).ok
  );

  const job4 = await createAuthorizedJob(`phase5b1-4-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: job4.id,
        scheduledDate: busyDate,
        scheduledWindow: "flex",
      })
    ).ok
  );

  const job5 = await createAuthorizedJob(`phase5b1-5-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: job5.id,
        scheduledDate: busyDate,
        scheduledWindow: "am",
      })
    ).ok
  );

  const monthJobs = await listJobsForCalendarRange({
    weekStart: grid.gridStart,
    weekEnd: grid.gridEnd,
  });
  const onDay = monthJobs
    .filter((j) => j.scheduled_date === busyDate)
    .filter((j) =>
      [jobAm.id, jobPm.id, jobFlex.id, job4.id, job5.id].includes(j.id)
    )
    .sort(compareJobsForCalendarDay);

  check("job_on_correct_date", onDay.length === 5, `n=${onDay.length}`);
  check(
    "am_pm_flex_present",
    onDay.some((j) => j.id === jobAm.id && j.scheduled_window === "am") &&
      onDay.some((j) => j.id === jobPm.id && j.scheduled_window === "pm") &&
      onDay.some((j) => j.id === jobFlex.id && j.scheduled_window === "flex")
  );

  const first3 = onDay.slice(0, 3);
  const overflowN = onDay.length - 3;
  check("first_3_shown_logic", first3.length === 3);
  check("plus_n_more_count", overflowN === 2, `n=${overflowN}`);
  check(
    "window_order_on_day",
    scheduleWindowSortRank(first3[0].scheduled_window) <=
      scheduleWindowSortRank(first3[1].scheduled_window) &&
      scheduleWindowSortRank(first3[1].scheduled_window) <=
        scheduleWindowSortRank(first3[2].scheduled_window)
  );

  // Worker / Unassigned / Status filters
  const worker = await createWorker({ displayName: `Phase5B1 W ${stamp}` });
  assert(worker.ok);
  assert(
    (
      await setJobAssignedWorker({
        jobId: jobAm.id,
        workerId: worker.worker.id,
      })
    ).ok
  );

  const byWorker = await listJobsForCalendarRange({
    weekStart: grid.gridStart,
    weekEnd: grid.gridEnd,
    workerId: worker.worker.id,
  });
  check(
    "worker_filter",
    byWorker.some((j) => j.id === jobAm.id) &&
      byWorker.every((j) => j.assigned_worker_id === worker.worker.id)
  );

  const unas = await listJobsForCalendarRange({
    weekStart: grid.gridStart,
    weekEnd: grid.gridEnd,
    workerId: "unassigned",
  });
  check(
    "unassigned_filter",
    unas.some((j) => j.id === jobPm.id) &&
      unas.every((j) => j.assigned_worker_id == null)
  );

  const byStatus = await listJobsForCalendarRange({
    weekStart: grid.gridStart,
    weekEnd: grid.gridEnd,
    status: "scheduled",
  });
  check(
    "status_filter",
    byStatus.some((j) => j.id === jobAm.id) &&
      byStatus.every((j) => j.status === "scheduled")
  );

  // Needs scheduling still works; legacy
  const needsJob = await createAuthorizedJob(`phase5b1-needs-${stamp}@example.com`);
  const needs = await listNeedsSchedulingJobs({ limit: 200 });
  check(
    "needs_scheduling_unchanged",
    needs.some((j) => j.id === needsJob.id)
  );

  // Job detail link pattern in page
  check(
    "job_detail_link_pattern",
    /\/command-center\/jobs\/\$\{job\.id\}/.test(src)
  );

  // Week default URL builder: no view=month when week
  check(
    "week_href_omits_view_param",
    /if \(view === "month"\)/.test(src) &&
      !/params\.set\("view", "week"\)/.test(src)
  );

  console.log(
    `\nPhase 5B.1 focused tests: ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
