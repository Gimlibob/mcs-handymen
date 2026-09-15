/**
 * Shared DB write safety for MCS Command Center scripts.
 *
 * Write-capable tooling must call assertSafeTestDatabaseUrl() (or
 * resolveSafeTestDatabaseUrl()) and must NOT silently fall back to
 * Production DATABASE_URL from .env.local.
 *
 * Production markers (known endpoint + primary branch name):
 *   ep-nameless-glitter-a5bbh1gv / production
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

/** Known Production compute endpoint id / host fragment. */
export const PRODUCTION_ENDPOINT_MARKERS = [
  "nameless-glitter",
  "a5bbh1gv",
  "ep-nameless-glitter-a5bbh1gv",
];

/** Neon primary branch name for this project. */
export const PRODUCTION_BRANCH_NAME = "production";

/** Development branch endpoint created for isolated tests. */
export const DEVELOPMENT_ENDPOINT_MARKERS = ["icy-heart", "a5aq5s9w"];

let envLoaded = false;

/**
 * Parse KEY=VALUE lines from a local env file (no export, simple form).
 * Does not print values.
 */
function applyEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Do not override an already-exported process env (CI / shell wins).
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadLocalEnv() {
  if (envLoaded) return;
  loadEnvConfig(process.cwd());
  // Next only auto-loads .env.test.local when NODE_ENV=test; always apply for scripts.
  applyEnvFile(join(process.cwd(), ".env.test.local"));
  envLoaded = true;
}

/**
 * Extract hostname from a postgres connection string without logging secrets.
 * @param {string} connectionString
 * @returns {string | null}
 */
export function databaseHostFromUrl(connectionString) {
  if (!connectionString || typeof connectionString !== "string") return null;
  try {
    return new URL(connectionString.trim().replace(/^postgres(ql)?:/i, "https:"))
      .hostname;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} host
 */
export function isProductionDatabaseHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return PRODUCTION_ENDPOINT_MARKERS.some((m) => h.includes(m.toLowerCase()));
}

/**
 * @param {string | null | undefined} host
 */
export function isDevelopmentDatabaseHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return DEVELOPMENT_ENDPOINT_MARKERS.some((m) => h.includes(m.toLowerCase()));
}

/**
 * Resolve URL intended for destructive/write scripts.
 * Requires TEST_DATABASE_URL — never falls back to DATABASE_URL.
 *
 * @param {{ allowEnvLoad?: boolean }} [opts]
 * @returns {{ ok: true, url: string, host: string } | { ok: false, reason: string }}
 */
export function resolveSafeTestDatabaseUrl({ allowEnvLoad = true } = {}) {
  if (allowEnvLoad) loadLocalEnv();

  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) {
    return {
      ok: false,
      reason:
        "REFUSED: TEST_DATABASE_URL is missing. Set it in .env.test.local to the Neon development branch. DATABASE_URL fallback is not allowed for writes.",
    };
  }

  const host = databaseHostFromUrl(url);
  if (!host) {
    return {
      ok: false,
      reason: "REFUSED: TEST_DATABASE_URL is not a valid connection string.",
    };
  }

  if (isProductionDatabaseHost(host)) {
    return {
      ok: false,
      reason:
        "REFUSED: database writes are not allowed against Production. TEST_DATABASE_URL points at Production endpoint ep-nameless-glitter-a5bbh1gv.",
    };
  }

  const declaredBranch = (
    process.env.NEON_BRANCH ||
    process.env.CC_DB_BRANCH ||
    ""
  )
    .trim()
    .toLowerCase();
  if (declaredBranch === PRODUCTION_BRANCH_NAME) {
    return {
      ok: false,
      reason:
        "REFUSED: database writes are not allowed against Production. NEON_BRANCH/CC_DB_BRANCH is set to production.",
    };
  }

  return { ok: true, url, host };
}

/**
 * Throws when TEST_DATABASE_URL is unsafe or missing.
 * @returns {{ url: string, host: string }}
 */
export function assertSafeTestDatabaseUrl(opts = {}) {
  const result = resolveSafeTestDatabaseUrl(opts);
  if (!result.ok) {
    console.error(result.reason);
    const err = new Error(result.reason);
    err.code = "MCS_DB_WRITE_REFUSED";
    throw err;
  }
  return { url: result.url, host: result.host };
}

/**
 * Point this process at the safe test DB for lib/cc/db/* (which read DATABASE_URL).
 * Never falls back to Production DATABASE_URL.
 * @returns {{ url: string, host: string }}
 */
export function bindProcessToSafeTestDatabase(opts = {}) {
  const resolved = assertSafeTestDatabaseUrl(opts);
  process.env.DATABASE_URL = resolved.url;
  return resolved;
}

/**
 * Non-throwing probe for verification scripts.
 * @param {string} [overrideUrl]
 */
export function evaluateWriteEligibility(overrideUrl) {
  if (overrideUrl !== undefined) {
    const prev = process.env.TEST_DATABASE_URL;
    process.env.TEST_DATABASE_URL = overrideUrl;
    try {
      return resolveSafeTestDatabaseUrl({ allowEnvLoad: false });
    } finally {
      if (prev === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = prev;
    }
  }
  return resolveSafeTestDatabaseUrl();
}
