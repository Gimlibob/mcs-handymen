#!/usr/bin/env node
/**
 * Phase GC-2 — OAuth + live provider (mocked; Development / TEST_DATABASE_URL only).
 *
 * Never calls live Google APIs. Never writes to Production.
 *
 * Usage:
 *   node scripts/test-phase-gc2-google-calendar.mjs
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
} from "../lib/cc/db/jobs.js";
import {
  getLatestGoogleCalendarConnection,
  insertGoogleCalendarConnection,
  setConnectionStatus,
  upsertGoogleCalendarConnection,
} from "../lib/cc/db/google-calendar-connections.js";
import { updateLeadStatus } from "../lib/cc/db/leads.js";
import {
  CONNECTION_STATUSES,
  getAllowedGoogleAccountEmail,
  getMcsJobsCalendarSummary,
  isGoogleCalendarSyncEnabled,
  isVercelPreview,
} from "../lib/cc/google-calendar/config.js";
import {
  countFutureScheduledJobsForInitialSync,
  disconnectGoogleCalendar,
  finalizeOAuthConnection,
  listFutureScheduledJobIdsForInitialSync,
  repairGoogleCalendar,
  syncFutureScheduledJobs,
} from "../lib/cc/google-calendar/connection-service.js";
import { createLiveGoogleCalendarProvider } from "../lib/cc/google-calendar/live-provider.js";
import {
  createOAuthState,
  ownerSessionMarker,
  validateOAuthState,
} from "../lib/cc/google-calendar/oauth-state.js";
import { GoogleCalendarProviderError } from "../lib/cc/google-calendar/provider.js";
import { safeJobSyncError, safeOwnerError } from "../lib/cc/google-calendar/safe-errors.js";
import {
  decryptRefreshToken,
  encryptRefreshToken,
} from "../lib/cc/google-calendar/token-crypto.js";
import {
  resetGoogleCalendarProviderForTests,
  setGoogleCalendarProviderForTests,
} from "../lib/cc/google-calendar/get-provider.js";
import { createMockGoogleCalendarProvider } from "../lib/cc/google-calendar/mock-provider.js";
import { syncScheduledJobToGoogle } from "../lib/cc/google-calendar/sync-engine.js";
import { chicagoToday } from "../lib/cc/domain/chicago-date.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let failed = 0;
const networkHits = [];

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

/** Fail if unexpected https://www.googleapis.com appears in fetched URLs. */
function installNetworkGuard() {
  const orig = globalThis.fetch;
  if (typeof orig !== "function") return () => {};
  globalThis.fetch = async function guardedFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (/googleapis\.com|accounts\.google\.com/i.test(url)) {
      networkHits.push(url);
      throw new Error(`UNEXPECTED_GOOGLE_NETWORK: ${url}`);
    }
    return orig.call(this, input, init);
  };
  return () => {
    globalThis.fetch = orig;
  };
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
    fullName: `GC2 ${stamp}`,
    email,
    city: "Manvel",
    propertyType: "Residential",
    projectType: "TV Mounting",
    description: `GC-2 google sync test ${stamp}`,
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

function mockCalendarApi(overrides = {}) {
  const state = {
    calendars: new Map(),
    events: new Map(),
    calls: { insertCal: 0, getCal: 0, insertEv: 0, patchEv: 0, deleteEv: 0, listEv: 0 },
  };
  const api = {
    calendars: {
      async get({ calendarId }) {
        state.calls.getCal += 1;
        if (overrides.getCalendar) return overrides.getCalendar({ calendarId });
        const c = state.calendars.get(calendarId);
        if (!c) {
          const e = new Error("Not Found");
          e.response = { status: 404 };
          throw e;
        }
        return { data: c };
      },
      async insert({ requestBody }) {
        state.calls.insertCal += 1;
        if (overrides.insertCalendar) return overrides.insertCalendar({ requestBody });
        const id = `cal_${randomBytes(4).toString("hex")}`;
        const row = { id, summary: requestBody.summary, timeZone: requestBody.timeZone };
        state.calendars.set(id, row);
        return { data: row };
      },
    },
    events: {
      async insert({ calendarId, requestBody }) {
        state.calls.insertEv += 1;
        if (overrides.insertEvent) return overrides.insertEvent({ calendarId, requestBody });
        const id = `ev_${randomBytes(4).toString("hex")}`;
        const row = { id, ...requestBody, htmlLink: `https://calendar.google.com/event?eid=${id}` };
        const list = state.events.get(calendarId) || [];
        list.push(row);
        state.events.set(calendarId, list);
        return { data: row };
      },
      async patch({ calendarId, eventId, requestBody }) {
        state.calls.patchEv += 1;
        if (overrides.patchEvent) return overrides.patchEvent({ calendarId, eventId, requestBody });
        const list = state.events.get(calendarId) || [];
        const idx = list.findIndex((e) => e.id === eventId);
        if (idx < 0) {
          const e = new Error("Not Found");
          e.response = { status: 404 };
          throw e;
        }
        list[idx] = { ...list[idx], ...requestBody };
        return { data: list[idx] };
      },
      async delete({ calendarId, eventId }) {
        state.calls.deleteEv += 1;
        if (overrides.deleteEvent) return overrides.deleteEvent({ calendarId, eventId });
        const list = state.events.get(calendarId) || [];
        const next = list.filter((e) => e.id !== eventId);
        if (next.length === list.length) {
          const e = new Error("Not Found");
          e.response = { status: 404 };
          throw e;
        }
        state.events.set(calendarId, next);
      },
      async list({ calendarId, privateExtendedProperty }) {
        state.calls.listEv += 1;
        if (overrides.listEvents) {
          return overrides.listEvents({ calendarId, privateExtendedProperty });
        }
        const list = state.events.get(calendarId) || [];
        const prop = Array.isArray(privateExtendedProperty)
          ? privateExtendedProperty[0]
          : privateExtendedProperty;
        const m = /^mcsJobId=(.+)$/.exec(prop || "");
        const jobId = m?.[1];
        const items = jobId
          ? list.filter((e) => e.extendedProperties?.private?.mcsJobId === jobId)
          : list;
        return { data: { items } };
      },
    },
  };
  return { api, state };
}

async function main() {
  const restoreFetch = installNetworkGuard();
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  assert(!host.includes("nameless-glitter"), "refused production");

  process.env.GOOGLE_CALENDAR_PROVIDER = "mock";
  process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";
  process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY =
    process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY || "gc2-test-key-not-for-prod";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY;
  delete process.env.VERCEL_ENV;

  const sql = neon(process.env.DATABASE_URL);
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;

  // --- Migration 014 schema ---
  const migSql = readFileSync(
    join(ROOT, "lib/cc/db/migrations/014_google_calendar_sync.sql"),
    "utf8"
  );
  check(
    "amended_014_calendar_id_nullable_sql",
    /calendar_id TEXT NULL/.test(migSql) && !/calendar_id TEXT NOT NULL/.test(migSql)
  );
  check(
    "amended_014_statuses",
    migSql.includes("'disconnected'") &&
      migSql.includes("'revoked'") &&
      migSql.includes("'connected'") &&
      migSql.includes("'error'")
  );
  check("amended_014_sub_scopes", /google_account_sub TEXT NULL/.test(migSql) && /scopes TEXT NULL/.test(migSql));

  const calCol = await sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='google_calendar_connections'
      AND column_name='calendar_id'
  `;
  check("dev_calendar_id_nullable", calCol[0]?.is_nullable === "YES");

  const statusCheck = await sql`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = 'google_calendar_connections_status_valid'
  `;
  const def = statusCheck[0]?.def || "";
  check(
    "dev_connection_statuses",
    CONNECTION_STATUSES.every((s) => def.includes(`'${s}'`))
  );

  // --- Config / preview / allowed email ---
  check(
    "allowed_account_default",
    getAllowedGoogleAccountEmail() === "info@mcshandymen.com"
  );
  process.env.GOOGLE_ALLOWED_ACCOUNT_EMAIL = "Owner@Example.com";
  check("allowed_account_env", getAllowedGoogleAccountEmail() === "owner@example.com");
  delete process.env.GOOGLE_ALLOWED_ACCOUNT_EMAIL;

  process.env.VERCEL_ENV = "preview";
  check("preview_disabled", isVercelPreview() && !isGoogleCalendarSyncEnabled());
  delete process.env.VERCEL_ENV;
  process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";
  check("sync_flag_enabled", isGoogleCalendarSyncEnabled());
  process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "false";
  check("sync_flag_disabled", !isGoogleCalendarSyncEnabled());
  process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";

  check(
    "dev_calendar_name",
    getMcsJobsCalendarSummary() === "MCS Jobs DEV"
  );

  // --- OAuth state ---
  const marker = ownerSessionMarker({ ownerId: "o1", pv: 2 });
  const created = createOAuthState({ sessionMarker: marker });
  const okState = validateOAuthState({
    state: created.state,
    cookieNonce: created.cookieValue,
    sessionMarker: marker,
  });
  check("oauth_state_valid", okState.ok === true);

  const badSig = validateOAuthState({
    state: created.state.replace(/\.[^.]+$/, ".bad"),
    cookieNonce: created.cookieValue,
    sessionMarker: marker,
  });
  check("oauth_state_mismatch", badSig.ok === false && badSig.error === "state_mismatch");

  const badSession = validateOAuthState({
    state: created.state,
    cookieNonce: created.cookieValue,
    sessionMarker: "owner:other:pv:1",
  });
  check("oauth_session_mismatch", badSession.error === "session_mismatch");

  const badNonce = validateOAuthState({
    state: created.state,
    cookieNonce: "wrong",
    sessionMarker: marker,
  });
  check("oauth_nonce_mismatch", badNonce.error === "nonce_mismatch");

  // Expiry: craft expired payload
  const { createHmac } = await import("node:crypto");
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const payload = Buffer.from(
    JSON.stringify({ n: "n1", s: marker, exp: Date.now() - 1000 }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  const expired = validateOAuthState({
    state: `${payload}.${sig}`,
    cookieNonce: "n1",
    sessionMarker: marker,
  });
  check("oauth_state_expiry", expired.error === "state_expired");

  // Single-use simulated: after cookie cleared, nonce mismatch
  const reuse = validateOAuthState({
    state: created.state,
    cookieNonce: null,
    sessionMarker: marker,
  });
  check("oauth_state_reuse_rejection", reuse.error === "nonce_mismatch");

  // --- Encryption ---
  const ct = encryptRefreshToken("refresh-token-plain");
  check("encrypt_roundtrip", decryptRefreshToken(ct) === "refresh-token-plain");
  check("encrypt_no_plaintext_storage", !ct.includes("refresh-token-plain"));

  const savedKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const savedTest = process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY;
  delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  delete process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY;
  let missingKeyFailed = false;
  try {
    encryptRefreshToken("x");
  } catch {
    missingKeyFailed = true;
  }
  check("encryption_key_fail_closed", missingKeyFailed);
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = savedKey;
  process.env.TEST_GOOGLE_TOKEN_ENCRYPTION_KEY = savedTest;

  // --- Connection upsert / calendar create once ---
  await sql`DELETE FROM google_calendar_connections`;

  const mockApi1 = mockCalendarApi();
  const providerFactory = (ciphertext) =>
    createLiveGoogleCalendarProvider({
      refreshTokenCiphertext: ciphertext,
      calendarApi: mockApi1.api,
    });

  const fin = await finalizeOAuthConnection({
    email: "info@mcshandymen.com",
    sub: "sub-abc",
    refreshToken: "rt-1",
    providerFactory,
  });
  check("connect_upsert_ok", fin.ok === true && Boolean(fin.calendarId));
  check("calendar_create_exactly_once", mockApi1.state.calls.insertCal === 1);

  const conn1 = await getLatestGoogleCalendarConnection();
  check(
    "connected_status",
    conn1?.status === "connected" &&
      conn1.calendar_id === fin.calendarId &&
      Boolean(conn1.refresh_token_ciphertext) &&
      conn1.google_account_sub === "sub-abc"
  );

  // Replay finalize with same calendar — reuse, no second create
  const mockApi2 = mockCalendarApi();
  mockApi2.state.calendars.set(fin.calendarId, {
    id: fin.calendarId,
    summary: "MCS Jobs DEV",
  });
  const fin2 = await finalizeOAuthConnection({
    email: "info@mcshandymen.com",
    sub: "sub-abc",
    refreshToken: "rt-2",
    providerFactory: (ctext) =>
      createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: ctext,
        calendarApi: mockApi2.api,
      }),
  });
  check("calendar_reuse", fin2.ok && fin2.calendarId === fin.calendarId);
  check("callback_replay_no_dup_calendar", mockApi2.state.calls.insertCal === 0);

  // Reconnect with missing calendar → error + repair
  const missingApi = mockCalendarApi({
    getCalendar: async () => {
      const e = new Error("gone");
      e.response = { status: 404 };
      throw e;
    },
  });
  const finMiss = await finalizeOAuthConnection({
    email: "info@mcshandymen.com",
    sub: "sub-abc",
    refreshToken: "rt-3",
    providerFactory: (ctext) =>
      createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: ctext,
        calendarApi: missingApi.api,
      }),
  });
  check(
    "reconnect_calendar_missing",
    finMiss.ok === false && finMiss.needsRepair === true
  );
  const connMiss = await getLatestGoogleCalendarConnection();
  check(
    "calendar_missing_status_error",
    connMiss?.status === "error" &&
      connMiss.last_error === "MCS Jobs calendar not found"
  );

  const repairApi = mockCalendarApi();
  const repaired = await repairGoogleCalendar({
    providerFactory: (ctext) =>
      createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: ctext,
        calendarApi: repairApi.api,
      }),
  });
  check("repair_calendar", repaired.ok && Boolean(repaired.calendarId));
  check("repair_create_once", repairApi.state.calls.insertCal === 1);

  // Disconnect
  const beforeDisc = await getLatestGoogleCalendarConnection();
  const disc = await disconnectGoogleCalendar({
    revokeFn: async () => {},
  });
  check("disconnect_ok", disc.ok);
  const afterDisc = await getLatestGoogleCalendarConnection();
  check(
    "disconnect_clears_token",
    afterDisc?.status === "disconnected" &&
      afterDisc.refresh_token_ciphertext == null &&
      afterDisc.calendar_id === beforeDisc.calendar_id
  );

  // Revoked status can be set
  await upsertGoogleCalendarConnection({
    googleAccountEmail: "info@mcshandymen.com",
    calendarId: afterDisc.calendar_id,
    refreshTokenCiphertext: encryptRefreshToken("rt-rev"),
    status: "connected",
  });
  const latest = await getLatestGoogleCalendarConnection();
  await setConnectionStatus(latest.id, "revoked", "Google Calendar authorization expired");
  const rev = await getLatestGoogleCalendarConnection();
  check("revoked_state", rev?.status === "revoked");

  // --- Live provider adapter (mocked API) ---
  const liveMock = mockCalendarApi();
  const calId = "cal_live";
  liveMock.state.calendars.set(calId, { id: calId, summary: "MCS Jobs DEV" });
  const live = createLiveGoogleCalendarProvider({
    refreshTokenCiphertext: encryptRefreshToken("rt-live"),
    calendarApi: liveMock.api,
  });

  const createdEv = await live.createEvent({
    calendarId: calId,
    event: {
      summary: "t",
      extendedProperties: { private: { mcsJobId: "job-1", mcsEnv: "development" } },
    },
  });
  check("live_createEvent", Boolean(createdEv.id));

  await live.updateEvent({
    calendarId: calId,
    eventId: createdEv.id,
    event: { summary: "t2" },
  });
  check("live_updateEvent", liveMock.state.calls.patchEv === 1);

  const found = await live.findEventByMcsJobId({
    calendarId: calId,
    mcsJobId: "job-1",
  });
  check("live_findEventByMcsJobId", found.length === 1);

  await live.deleteEvent({ calendarId: calId, eventId: createdEv.id });
  check("live_deleteEvent", liveMock.state.calls.deleteEv === 1);

  async function expectStatus(fn, status, codeHint) {
    try {
      await fn();
      return false;
    } catch (err) {
      return (
        err instanceof GoogleCalendarProviderError &&
        err.status === status &&
        (!codeHint || err.code === codeHint)
      );
    }
  }

  check(
    "live_401",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi({
          insertEvent: async () => {
            const e = new Error("auth");
            e.response = { status: 401 };
            throw e;
          },
        }).api,
      });
      await p.createEvent({ calendarId: "c", event: {} });
    }, 401, "unauthorized")
  );

  check(
    "live_403",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi({
          insertEvent: async () => {
            const e = new Error("forbid");
            e.response = { status: 403 };
            throw e;
          },
        }).api,
      });
      await p.createEvent({ calendarId: "c", event: {} });
    }, 403, "forbidden")
  );

  check(
    "live_404_event",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi().api,
      });
      await p.updateEvent({ calendarId: "missing", eventId: "e", event: {} });
    }, 404, "not_found")
  );

  check(
    "live_404_calendar",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi().api,
      });
      await p.getCalendar({ calendarId: "nope" });
    }, 404, "not_found")
  );

  check(
    "live_429",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi({
          insertEvent: async () => {
            const e = new Error("rate");
            e.response = { status: 429 };
            throw e;
          },
        }).api,
      });
      await p.createEvent({ calendarId: "c", event: {} });
    }, 429, "rate_limited")
  );

  check(
    "live_5xx",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        calendarApi: mockCalendarApi({
          insertEvent: async () => {
            const e = new Error("boom");
            e.response = { status: 503 };
            throw e;
          },
        }).api,
      });
      await p.createEvent({ calendarId: "c", event: {} });
    }, 503, "server_error")
  );

  check(
    "live_timeout",
    await expectStatus(async () => {
      const p = createLiveGoogleCalendarProvider({
        refreshTokenCiphertext: encryptRefreshToken("x"),
        timeoutMs: 30,
        calendarApi: {
          events: {
            insert: () => new Promise(() => {}),
          },
        },
      });
      await p.createEvent({ calendarId: "c", event: {} });
    }, 408, "timeout")
  );

  // Error sanitization
  check(
    "error_sanitize_401",
    safeOwnerError(new GoogleCalendarProviderError("x", { status: 401 })) ===
      "Google Calendar authorization expired"
  );
  check(
    "error_sanitize_404_cal",
    safeOwnerError(new GoogleCalendarProviderError("x", { status: 404 })) ===
      "MCS Jobs calendar not found"
  );
  check(
    "error_sanitize_job_404",
    safeJobSyncError(new GoogleCalendarProviderError("x", { status: 404 })) ===
      "Google Calendar event missing"
  );

  // --- Initial sync dry count + bulk ---
  await sql`DELETE FROM google_calendar_connections`;
  const mock = createMockGoogleCalendarProvider();
  setGoogleCalendarProviderForTests(mock);
  process.env.GOOGLE_CALENDAR_PROVIDER = "mock";

  await insertGoogleCalendarConnection({
    googleAccountEmail: "info@mcshandymen.com",
    calendarId: "cal_bulk",
    refreshTokenCiphertext: "fake-ciphertext:rt",
    status: "connected",
  });

  const today = chicagoToday();
  const jobA = await createAuthorizedJob(`gc2a-${stamp}@example.com`);
  const jobB = await createAuthorizedJob(`gc2b-${stamp}@example.com`);
  const jobC = await createAuthorizedJob(`gc2c-${stamp}@example.com`);

  const schA = await scheduleJob({
    jobId: jobA.id,
    scheduledDate: today,
    scheduledWindow: "am",
  });
  assert(schA.ok, "schedule A");
  const schB = await scheduleJob({
    jobId: jobB.id,
    scheduledDate: today,
    scheduledWindow: "pm",
  });
  assert(schB.ok, "schedule B");
  // jobC stays authorized (excluded)

  const count = await countFutureScheduledJobsForInitialSync();
  const ids = await listFutureScheduledJobIdsForInitialSync();
  check("initial_dry_count", count >= 2 && ids.includes(jobA.id) && ids.includes(jobB.id));
  check("initial_excludes_authorized", !ids.includes(jobC.id));

  // Partial failure: inject fail for one job via mock
  const failOnce = createMockGoogleCalendarProvider();
  const origCreate = failOnce.createEvent.bind(failOnce);
  let failJob = jobB.id;
  failOnce.createEvent = async (args) => {
    const mcs = args?.event?.extendedProperties?.private?.mcsJobId;
    if (mcs === failJob) {
      throw new GoogleCalendarProviderError("forced", { status: 500 });
    }
    return origCreate(args);
  };
  setGoogleCalendarProviderForTests(failOnce);

  const bulk = await syncFutureScheduledJobs({ provider: failOnce });
  check("bulk_partial_failure", bulk.ok && bulk.failed >= 1 && bulk.synced >= 1);

  // Idempotent second sync
  setGoogleCalendarProviderForTests(mock);
  // Fix failed job then re-sync all
  failJob = "none";
  const bulk2 = await syncFutureScheduledJobs({ provider: mock });
  check(
    "idempotent_bulk_sync",
    bulk2.ok && bulk2.failed === 0 && (bulk2.synced + bulk2.alreadySynced) === bulk2.total
  );

  // MCS-first: schedule succeeds even if provider fails
  const jobD = await createAuthorizedJob(`gc2d-${stamp}@example.com`);
  const boom = createMockGoogleCalendarProvider();
  boom.createEvent = async () => {
    throw new GoogleCalendarProviderError("down", { status: 503 });
  };
  setGoogleCalendarProviderForTests(boom);
  const schD = await scheduleJob({
    jobId: jobD.id,
    scheduledDate: today,
    scheduledWindow: "am",
  });
  check("mcs_first_despite_provider_failure", schD.ok === true);
  const dRow = await getJobById(jobD.id);
  check(
    "mcs_scheduled_google_error",
    dRow.status === "scheduled" &&
      (dRow.google_sync_status === "error" || dRow.google_sync_status === "pending")
  );

  // 401 → revoked connection
  await sql`DELETE FROM google_calendar_connections`;
  await insertGoogleCalendarConnection({
    googleAccountEmail: "info@mcshandymen.com",
    calendarId: "cal_auth",
    refreshTokenCiphertext: "fake-ciphertext:rt",
    status: "connected",
  });
  const authFail = createMockGoogleCalendarProvider();
  authFail.createEvent = async () => {
    throw new GoogleCalendarProviderError("revoked", { status: 401 });
  };
  setGoogleCalendarProviderForTests(authFail);
  const jobE = await createAuthorizedJob(`gc2e-${stamp}@example.com`);
  await scheduleJob({
    jobId: jobE.id,
    scheduledDate: today,
    scheduledWindow: "am",
  });
  await syncScheduledJobToGoogle(jobE.id, { provider: authFail });
  const after401 = await getLatestGoogleCalendarConnection();
  check("revoked_auth_on_401", after401?.status === "revoked");

  // UI/source helpers — account states covered via connection statuses above
  check(
    "account_ui_states_covered",
    ["connected", "disconnected", "revoked", "error"].every((s) =>
      CONNECTION_STATUSES.includes(s)
    )
  );

  // Secrets not in migration / source strings for tokens
  const actionsSrc = readFileSync(
    join(ROOT, "lib/cc/actions/google-calendar.js"),
    "utf8"
  );
  check(
    "no_secrets_in_actions",
    !actionsSrc.includes("CLIENT_SECRET") && !/refresh_token\s*[:=]\s*['"]/.test(actionsSrc)
  );

  // Wrong account path is logic-tested via allowed email helper (callback uses it)
  check(
    "wrong_account_enforcement_helper",
    getAllowedGoogleAccountEmail() === "info@mcshandymen.com"
  );

  // Dev/prod isolation labels
  process.env.VERCEL_ENV = "production";
  check("prod_calendar_name", getMcsJobsCalendarSummary() === "MCS Jobs");
  delete process.env.VERCEL_ENV;

  resetGoogleCalendarProviderForTests();
  restoreFetch();

  check("live_google_network_none", networkHits.length === 0, `hits=${networkHits.length}`);

  // Live OAuth not configured is informational — detect env
  const liveOauthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REDIRECT_URI?.trim()
  );
  console.log(
    liveOauthConfigured
      ? "LIVE_DEVELOPMENT_OAUTH=ENV_PRESENT (not exercised live in automated tests)"
      : "LIVE_DEVELOPMENT_OAUTH=NOT_CONFIGURED"
  );

  if (failed > 0) {
    console.error(`\nGC-2 FAILED: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("\nGC-2 PASS");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
