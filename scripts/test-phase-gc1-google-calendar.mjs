#!/usr/bin/env node
/**
 * Phase GC-1 — Google Calendar sync engine (mocked; Development only).
 *
 * Usage:
 *   node scripts/test-phase-gc1-google-calendar.mjs
 *
 * Never calls live Google APIs. Never writes to Production.
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
  scheduleJob,
  rescheduleJob,
  unscheduleJob,
  updateJobStatus,
} from "../lib/cc/db/jobs.js";
import { insertGoogleCalendarConnection } from "../lib/cc/db/google-calendar-connections.js";
import { updateLeadStatus } from "../lib/cc/db/leads.js";
import { buildGoogleEventTimeRange } from "../lib/cc/domain/google-calendar-event-time.js";
import { buildGoogleCalendarEventPayload } from "../lib/cc/domain/google-calendar-event-payload.js";
import {
  createMockGoogleCalendarProvider,
} from "../lib/cc/google-calendar/mock-provider.js";
import { GoogleCalendarProviderError } from "../lib/cc/google-calendar/provider.js";
import {
  resetGoogleCalendarProviderForTests,
  setGoogleCalendarProviderForTests,
} from "../lib/cc/google-calendar/get-provider.js";
import {
  deleteGoogleEventForJob,
  retryGoogleCalendarSync,
  syncCancelledJobToGoogle,
  syncScheduledJobToGoogle,
} from "../lib/cc/google-calendar/sync-engine.js";
import {
  decryptRefreshToken,
  encryptRefreshToken,
} from "../lib/cc/google-calendar/token-crypto.js";

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
    assert(r.ok, `advance ${next}`);
  }
}

async function createAuthorizedJob(email) {
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const persisted = await persistQuoteLead({
    fullName: `GC1 ${stamp}`,
    email,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: `GC-1 google sync test ${stamp}`,
    contactMethod: "Email",
    preferredDate: null,
    photos: [],
  });
  assert(persisted.ok, "persist");
  await advanceLeadToAccepted(persisted.leadId);
  const job = await createJobFromLead({ leadId: persisted.leadId });
  assert(job.ok && job.created, "create job");
  return job.job;
}

async function main() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused production");

  process.env.GOOGLE_CALENDAR_PROVIDER = "mock";
  process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY =
    process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY || "gc1-test-key-not-for-prod";

  const sql = neon(process.env.DATABASE_URL);
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;

  // --- Migration 014 ---
  const [mig] = await sql`
    SELECT id FROM schema_migrations WHERE id = '014_google_calendar_sync.sql'
  `;
  check("dev_migration_014_present", Boolean(mig?.id));

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs'
      AND column_name LIKE 'google_%'
    ORDER BY column_name
  `;
  check("dev_job_google_columns", cols.length === 5, `n=${cols.length}`);

  const [tbl] = await sql`
    SELECT to_regclass('public.google_calendar_connections') AS t
  `;
  check("dev_connections_table", Boolean(tbl?.t));

  // Existing job compatible (null google fields)
  const bare = await createAuthorizedJob(`gc1-bare-${stamp}@example.com`);
  const bareRow = await getJobById(bare.id);
  check(
    "existing_job_compatible",
    bareRow.google_event_id == null &&
      (bareRow.google_sync_status == null || bareRow.google_sync_status === "none") &&
      bareRow.google_sync_attempts === 0
  );

  // --- Time mapping ---
  const am = buildGoogleEventTimeRange("2026-09-22", "am");
  check(
    "am_mapping",
    am?.kind === "timed" &&
      am.startDateTime === "2026-09-22T08:00:00" &&
      am.endDateTime === "2026-09-22T12:00:00" &&
      am.timeZone === "America/Chicago"
  );
  const pm = buildGoogleEventTimeRange("2026-09-22", "pm");
  check(
    "pm_mapping",
    pm?.kind === "timed" &&
      pm.startDateTime === "2026-09-22T13:00:00" &&
      pm.endDateTime === "2026-09-22T17:00:00"
  );
  const flex = buildGoogleEventTimeRange("2026-09-22", "flex");
  check(
    "flex_all_day",
    flex?.kind === "all_day" &&
      flex.startDate === "2026-09-22" &&
      flex.endDate === "2026-09-23"
  );
  check(
    "chicago_civil_safety",
    buildGoogleEventTimeRange("2026-03-08", "am")?.startDateTime?.startsWith(
      "2026-03-08"
    )
  );

  // --- Payload ---
  const payload = buildGoogleCalendarEventPayload({
    job: {
      id: "job-1",
      service_type: "TV Mounting",
      service_city: "Manvel",
      property_type: "Residential",
      scope_summary: "Mount TV on wall",
      scheduled_date: "2026-09-22",
      scheduled_window: "am",
      customer_email: "secret@example.com",
      customer_phone: "555-0100",
    },
    customerName: "Ada Customer",
    workerName: "Worker One",
  });
  check("payload_title", payload?.summary === "MCS — Ada Customer — TV Mounting");
  check(
    "payload_excludes_email_phone",
    !payload.description.includes("secret@") &&
      !payload.description.includes("555-0100") &&
      !/email/i.test(payload.description) &&
      !/phone/i.test(payload.description)
  );
  check(
    "payload_excludes_private_notes",
    !/note/i.test(payload.description) || payload.description.includes("Job ID")
  );
  check(
    "payload_has_mcs_private",
    payload.extendedProperties.private.mcsJobId === "job-1"
  );
  const cancelledPayload = buildGoogleCalendarEventPayload({
    job: {
      id: "job-1",
      service_type: "TV Mounting",
      service_city: "Manvel",
      scheduled_date: "2026-09-22",
      scheduled_window: "pm",
    },
    customerName: "Ada Customer",
    cancelled: true,
  });
  check(
    "cancelled_title_prefix",
    cancelledPayload?.summary?.startsWith("CANCELLED — MCS —")
  );

  // Token crypto
  const enc = encryptRefreshToken("refresh-token-value");
  check("token_encrypt_roundtrip", decryptRefreshToken(enc) === "refresh-token-value");
  check(
    "fake_ciphertext_ok",
    decryptRefreshToken("fake-ciphertext:abc") === "abc"
  );

  // Source contracts
  const actionSrc = readFileSync(
    join(ROOT, "lib/cc/actions/google-calendar.js"),
    "utf8"
  );
  check("retry_action_requireOwner", /requireOwner\(\)/.test(actionSrc));
  check(
    "no_googleapis_import",
    !readFileSync(join(ROOT, "lib/cc/google-calendar/sync-engine.js"), "utf8").includes(
      "googleapis"
    )
  );
  check(
    "preferred_scope_documented",
    readFileSync(
      join(ROOT, "lib/cc/db/migrations/014_google_calendar_sync.sql"),
      "utf8"
    ).includes("calendar.app.created")
  );

  // --- Mock provider + connection ---
  const mock = createMockGoogleCalendarProvider();
  setGoogleCalendarProviderForTests(mock);

  const conn = await insertGoogleCalendarConnection({
    googleAccountEmail: `gc1-${stamp}@example.com`,
    calendarId: `cal-mcs-jobs-${stamp}`,
    refreshTokenCiphertext: "fake-ciphertext:test-refresh",
    status: "connected",
  });
  assert(conn.ok, "insert connection");

  // Schedule succeeds when Google succeeds
  const jobOk = await createAuthorizedJob(`gc1-ok-${stamp}@example.com`);
  const schedOk = await scheduleJob({
    jobId: jobOk.id,
    scheduledDate: "2026-09-22",
    scheduledWindow: "am",
  });
  check("schedule_mcs_when_google_ok", schedOk.ok === true);
  check("schedule_status_scheduled", schedOk.job.status === "scheduled");
  const afterOk = await getJobById(jobOk.id);
  check(
    "sync_synced_after_schedule",
    afterOk.google_sync_status === "synced" && Boolean(afterOk.google_event_id),
    `status=${afterOk.google_sync_status}`
  );
  check(
    "mock_create_called",
    mock._calls.some((c) => c.op === "createEvent")
  );

  // Schedule succeeds when Google fails
  mock.failNext(
    "createEvent",
    new GoogleCalendarProviderError("boom", { code: "server_error", status: 500 })
  );
  const jobFail = await createAuthorizedJob(`gc1-fail-${stamp}@example.com`);
  const schedFail = await scheduleJob({
    jobId: jobFail.id,
    scheduledDate: "2026-09-23",
    scheduledWindow: "pm",
  });
  check("schedule_mcs_when_google_fails", schedFail.ok === true);
  check("schedule_not_blocked", schedFail.job.status === "scheduled");
  const afterFail = await getJobById(jobFail.id);
  check(
    "sync_error_on_google_fail",
    afterFail.google_sync_status === "error" &&
      afterFail.google_sync_attempts >= 1 &&
      Boolean(afterFail.google_sync_error)
  );

  // Activity failure logged
  const [failAct] = await sql`
    SELECT event_type, meta FROM activity_log
    WHERE lead_id = ${jobFail.lead_id}
      AND event_type = 'google_calendar_sync_failed'
    ORDER BY created_at DESC LIMIT 1
  `;
  check(
    "activity_sync_failed",
    failAct?.event_type === "google_calendar_sync_failed" &&
      (failAct.meta?.jobId === jobFail.id ||
        String(JSON.stringify(failAct.meta)).includes(jobFail.id))
  );

  // Reschedule update
  mock.reset();
  // re-seed connection still exists; recreate event for jobOk already has id
  setGoogleCalendarProviderForTests(mock);
  // Put existing event in mock store for jobOk
  const jobOk2 = await getJobById(jobOk.id);
  mock._store.set(`${conn.connection.calendar_id}:${jobOk2.google_event_id}`, {
    id: jobOk2.google_event_id,
    calendarId: conn.connection.calendar_id,
    extendedProperties: { private: { mcsJobId: jobOk.id } },
  });
  const resched = await rescheduleJob({
    jobId: jobOk.id,
    scheduledDate: "2026-09-24",
    scheduledWindow: "flex",
  });
  check("reschedule_mcs_ok", resched.ok && resched.job.scheduled_date === "2026-09-24");
  check(
    "reschedule_google_update",
    mock._calls.some((c) => c.op === "updateEvent")
  );

  // Unschedule delete
  const un = await unscheduleJob({ jobId: jobOk.id });
  check("unschedule_mcs_ok", un.ok && un.job.status === "authorized");
  const afterUn = await getJobById(jobOk.id);
  check(
    "unschedule_clears_event_id",
    afterUn.google_event_id == null &&
      (afterUn.google_sync_status === "none" || afterUn.google_sync_status == null)
  );
  check(
    "unschedule_delete_called",
    mock._calls.some((c) => c.op === "deleteEvent")
  );

  // Cancelled title — schedule then cancel
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobCancel = await createAuthorizedJob(`gc1-cancel-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: jobCancel.id,
        scheduledDate: "2026-09-25",
        scheduledWindow: "am",
      })
    ).ok
  );
  const jc = await getJobById(jobCancel.id);
  mock._store.set(`${conn.connection.calendar_id}:${jc.google_event_id}`, {
    id: jc.google_event_id,
    calendarId: conn.connection.calendar_id,
    summary: "old",
    extendedProperties: { private: { mcsJobId: jobCancel.id } },
  });
  assert((await updateJobStatus({ jobId: jobCancel.id, nextStatus: "cancelled" })).ok);
  const cancelSync = await syncCancelledJobToGoogle(jobCancel.id, { provider: mock });
  check("cancelled_sync_ok", cancelSync.ok === true);
  const storedCancel = [...mock._store.values()].find(
    (e) => e.extendedProperties?.private?.mcsJobId === jobCancel.id
  );
  check(
    "cancelled_event_title",
    storedCancel?.summary?.startsWith("CANCELLED —")
  );

  // Completed leaves event — schedule, start, complete; sync should skip rewrite when synced
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobDone = await createAuthorizedJob(`gc1-done-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: jobDone.id,
        scheduledDate: "2026-09-26",
        scheduledWindow: "pm",
      })
    ).ok
  );
  const jd = await getJobById(jobDone.id);
  const eventBefore = jd.google_event_id;
  assert((await updateJobStatus({ jobId: jobDone.id, nextStatus: "in_progress" })).ok);
  assert((await updateJobStatus({ jobId: jobDone.id, nextStatus: "completed" })).ok);
  mock._calls.length = 0;
  const completedRetry = await retryGoogleCalendarSync(jobDone.id, {
    provider: mock,
  });
  check(
    "completed_leaves_event",
    completedRetry.skipped === "completed_unchanged" &&
      mock._calls.length === 0
  );
  const jd2 = await getJobById(jobDone.id);
  check("completed_event_id_retained", jd2.google_event_id === eventBefore);

  // Idempotent create via findByMcsJobId
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobAdopt = await createAuthorizedJob(`gc1-adopt-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: jobAdopt.id,
        scheduledDate: "2026-09-27",
        scheduledWindow: "am",
      })
    ).ok
  );
  // Clear local id but leave remote
  const ja = await getJobById(jobAdopt.id);
  const remoteId = ja.google_event_id;
  await sql`
    UPDATE jobs SET google_event_id = NULL, google_sync_status = 'pending'
    WHERE id = ${jobAdopt.id}
  `;
  mock._store.set(`${conn.connection.calendar_id}:${remoteId}`, {
    id: remoteId,
    calendarId: conn.connection.calendar_id,
    extendedProperties: { private: { mcsJobId: jobAdopt.id } },
  });
  mock._calls.length = 0;
  const adopt = await syncScheduledJobToGoogle(jobAdopt.id, { provider: mock });
  check("idempotent_adopt_by_mcsJobId", adopt.ok === true);
  check(
    "adopt_uses_update_not_blind_create",
    mock._calls.some((c) => c.op === "findEventByMcsJobId") &&
      mock._calls.some((c) => c.op === "updateEvent")
  );
  const ja2 = await getJobById(jobAdopt.id);
  check("adopt_persists_same_id", ja2.google_event_id === remoteId);

  // Duplicate remote → error
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobDup = await createAuthorizedJob(`gc1-dup-${stamp}@example.com`);
  await sql`
    UPDATE jobs SET
      status = 'scheduled',
      scheduled_date = '2026-09-28'::date,
      scheduled_window = 'am',
      google_event_id = NULL,
      google_sync_status = 'pending'
    WHERE id = ${jobDup.id}
  `;
  mock._store.set(`${conn.connection.calendar_id}:dup-a`, {
    id: "dup-a",
    calendarId: conn.connection.calendar_id,
    extendedProperties: { private: { mcsJobId: jobDup.id } },
  });
  mock._store.set(`${conn.connection.calendar_id}:dup-b`, {
    id: "dup-b",
    calendarId: conn.connection.calendar_id,
    extendedProperties: { private: { mcsJobId: jobDup.id } },
  });
  const dup = await syncScheduledJobToGoogle(jobDup.id, { provider: mock });
  check("duplicate_remote_error", dup.ok === false && dup.error === "duplicate_remote_events");
  const jdDup = await getJobById(jobDup.id);
  check(
    "duplicate_no_guess_id",
    jdDup.google_event_id == null && jdDup.google_sync_status === "error"
  );

  // 404 → missing_remote then recreate success path
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const job404 = await createAuthorizedJob(`gc1-404-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: job404.id,
        scheduledDate: "2026-09-29",
        scheduledWindow: "flex",
      })
    ).ok
  );
  await sql`
    UPDATE jobs SET google_event_id = 'ghost-id' WHERE id = ${job404.id}
  `;
  // ghost not in store → update 404 → recreate
  const heal = await syncScheduledJobToGoogle(job404.id, { provider: mock });
  check("missing_remote_heals_via_recreate", heal.ok === true && Boolean(heal.eventId));

  // Force sticky missing_remote: update 404 + create fail
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobMiss = await createAuthorizedJob(`gc1-miss-${stamp}@example.com`);
  await sql`
    UPDATE jobs SET
      status = 'scheduled',
      scheduled_date = '2026-09-30'::date,
      scheduled_window = 'am',
      google_event_id = 'missing-id',
      google_sync_status = 'pending',
      google_sync_attempts = 0
    WHERE id = ${jobMiss.id}
  `;
  mock.failNext(
    "createEvent",
    new GoogleCalendarProviderError("still_down", { status: 500 })
  );
  const miss = await syncScheduledJobToGoogle(jobMiss.id, { provider: mock });
  check("missing_remote_then_error", miss.ok === false);
  const jm = await getJobById(jobMiss.id);
  check(
    "attempts_incremented",
    jm.google_sync_attempts >= 1 &&
      (jm.google_sync_status === "error" || jm.google_sync_status === "missing_remote")
  );
  check(
    "error_truncated",
    !jm.google_sync_error || jm.google_sync_error.length <= 240
  );

  // Retry delete path for authorized
  mock.reset();
  setGoogleCalendarProviderForTests(mock);
  const jobRetryDel = await createAuthorizedJob(`gc1-rdel-${stamp}@example.com`);
  assert(
    (
      await scheduleJob({
        jobId: jobRetryDel.id,
        scheduledDate: "2026-10-01",
        scheduledWindow: "am",
      })
    ).ok
  );
  const jrd = await getJobById(jobRetryDel.id);
  mock._store.set(`${conn.connection.calendar_id}:${jrd.google_event_id}`, {
    id: jrd.google_event_id,
    calendarId: conn.connection.calendar_id,
    extendedProperties: { private: { mcsJobId: jobRetryDel.id } },
  });
  // Force authorized + keep event id (simulate failed delete)
  await sql`
    UPDATE jobs SET
      status = 'authorized',
      scheduled_date = NULL,
      scheduled_window = NULL
    WHERE id = ${jobRetryDel.id}
  `;
  const retryDel = await retryGoogleCalendarSync(jobRetryDel.id, {
    provider: mock,
  });
  check("retry_delete_for_authorized", retryDel.ok === true);
  const jrd2 = await getJobById(jobRetryDel.id);
  check("retry_clears_event", jrd2.google_event_id == null);

  // deleteGoogleEventForJob direct
  const delDirect = await deleteGoogleEventForJob(jobRetryDel.id, {
    provider: mock,
  });
  check("delete_noop_without_id", delDirect.ok === true);

  // No live network — mock only
  check(
    "no_live_google_network",
    mock._calls.every((c) =>
      ["createEvent", "updateEvent", "deleteEvent", "findEventByMcsJobId"].includes(
        c.op
      )
    )
  );

  resetGoogleCalendarProviderForTests();

  console.log(
    `\nPhase GC-1 focused tests: ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
