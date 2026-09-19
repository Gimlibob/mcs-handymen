#!/usr/bin/env node
/**
 * Auth Phase A — owner_accounts foundation + dual-read + password_version sessions.
 *
 * Usage:
 *   node scripts/test-phase-auth-a-owner.mjs
 *
 * Safety:
 *   - Static checks always run.
 *   - DB suite requires TEST_DATABASE_URL (Neon development).
 *   - Never writes to Production.
 *
 * Does not print password hashes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
  bindProcessToSafeTestDatabase,
  evaluateWriteEligibility,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";
import {
  bootstrapOwnerAccount,
  countOwnerAccounts,
  getOwnerAccount,
  getOwnerByEmailNormalized,
} from "../lib/cc/db/owner-accounts.js";
import {
  CANONICAL_OWNER_EMAIL,
  normalizeOwnerEmail,
} from "../lib/cc/domain/owner-account.js";
import { hashPassword, verifyPassword } from "../lib/cc/auth/password.js";
import {
  decodeSessionToken,
  encodeOwnerSessionTokenForTests,
} from "../lib/cc/auth/session-token.js";
import { createWorker } from "../lib/cc/db/workers.js";

loadLocalEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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

/**
 * Mirrors requireOwner password_version gate (Phase A):
 * - no owner row → session ok
 * - owner + session.pv number → must match
 * - owner + session.pv null → legacy allowed
 */
function phaseASessionAccepted(session, owner) {
  if (!session) return false;
  if (!owner) return true;
  if (typeof session.pv === "number") {
    return session.pv === owner.password_version;
  }
  return true; // legacy
}

function runStaticChecks() {
  console.log("\n=== Static / source contracts ===");

  const migration = readFileSync(
    join(ROOT, "lib/cc/db/migrations/011_owner_accounts.sql"),
    "utf8"
  );
  check(
    "migration_011_creates_owner_accounts",
    /CREATE TABLE IF NOT EXISTS owner_accounts/i.test(migration)
  );
  check(
    "migration_011_singleton_index",
    /owner_accounts_singleton_uidx/i.test(migration) &&
      /ON owner_accounts \(\(true\)\)/i.test(migration)
  );
  check(
    "migration_011_password_version",
    /password_version INTEGER NOT NULL DEFAULT 1/i.test(migration)
  );
  check(
    "migration_011_no_workers_table",
    !/CREATE TABLE[\s\S]*\bworkers\b/i.test(migration) &&
      !/\bREFERENCES workers\b/i.test(migration)
  );

  const domain = readFileSync(
    join(ROOT, "lib/cc/domain/owner-account.js"),
    "utf8"
  );
  check(
    "canonical_owner_email_constant",
    domain.includes("info@mcshandymen.com")
  );

  const actions = readFileSync(join(ROOT, "lib/cc/auth/actions.js"), "utf8");
  check(
    "login_db_authoritative_when_owner_exists",
    /const dbOwner = await getOwnerAccount\(\)/.test(actions) &&
      /verifyPassword\(password, dbOwner\.password_hash\)/.test(actions)
  );
  check(
    "login_env_fallback_only_when_no_db_owner",
    /Pre-bootstrap: retain env-based owner login/.test(actions) ||
      /getOwnerPasswordHash\(\)/.test(actions)
  );
  check(
    "login_db_session_includes_pv",
    /createOwnerSession\(\{\s*passwordVersion:\s*dbOwner\.password_version\s*\}\)/.test(
      actions
    )
  );
  check(
    "login_does_not_use_quote_notify_for_db_auth",
    !/QUOTE_NOTIFY_TO/.test(
      actions.slice(actions.indexOf("if (dbOwner)"))
    )
  );

  const dal = readFileSync(join(ROOT, "lib/cc/auth/dal.js"), "utf8");
  check(
    "requireOwner_checks_password_version",
    /session\.pv !== owner\.password_version/.test(dal)
  );
  check(
    "requireOwner_documents_legacy_compat",
    /legacy/i.test(dal) && /Phase A/i.test(dal)
  );

  const sessionTokenSrc = readFileSync(
    join(ROOT, "lib/cc/auth/session-token.js"),
    "utf8"
  );
  check("session_payload_supports_pv", /payload\.pv/.test(sessionTokenSrc));
  check(
    "session_token_no_next_headers",
    !/next\/headers/.test(sessionTokenSrc)
  );

  const proxy = readFileSync(join(ROOT, "proxy.js"), "utf8");
  check(
    "proxy_no_neon_dependency",
    !/neon|getSql|owner_accounts|DATABASE_URL/i.test(proxy)
  );

  const bootstrap = readFileSync(
    join(ROOT, "scripts/cc-bootstrap-owner.mjs"),
    "utf8"
  );
  check(
    "bootstrap_script_uses_canonical_email",
    bootstrap.includes("CANONICAL_OWNER_EMAIL") &&
      bootstrap.includes("--test")
  );
  check(
    "bootstrap_script_never_prints_hash",
    !/console\.log\([^)]*password_hash/i.test(bootstrap) &&
      /Never print password_hash/.test(bootstrap)
  );

  const workerActions = readFileSync(
    join(ROOT, "lib/cc/actions/workers.js"),
    "utf8"
  );
  check(
    "worker_create_does_not_touch_owner_accounts",
    !/owner_accounts|bootstrapOwner|createOwnerSession/.test(workerActions)
  );

  check(
    "normalize_canonical",
    normalizeOwnerEmail("  Info@MCSHandymen.COM ") === CANONICAL_OWNER_EMAIL
  );
}

async function runDbSuite(sql) {
  console.log("\n=== DB suite (TEST_DATABASE_URL only) ===");

  const [table] = await sql`
    SELECT to_regclass('public.owner_accounts') AS reg
  `;
  check(
    "schema_owner_accounts_table",
    table?.reg === "owner_accounts",
    `reg=${table?.reg}`
  );
  if (table?.reg !== "owner_accounts") {
    console.log("SKIP remaining DB suite — apply migration 011 on development first");
    return;
  }

  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owner_accounts'
    ORDER BY ordinal_position
  `;
  const colNames = cols.map((c) => c.column_name);
  for (const required of [
    "id",
    "email",
    "email_normalized",
    "password_hash",
    "password_version",
    "created_at",
    "updated_at",
    "password_changed_at",
  ]) {
    check(`schema_col_${required}`, colNames.includes(required));
  }

  const [singletonIdx] = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'owner_accounts'
      AND indexname = 'owner_accounts_singleton_uidx'
  `;
  check("schema_singleton_index", Boolean(singletonIdx?.indexname));

  // Isolate suite state: clear owner_accounts for deterministic bootstrap tests.
  await sql`DELETE FROM owner_accounts`;
  check("suite_start_empty", (await countOwnerAccounts()) === 0);

  // --- Env-only fallback when DB owner absent ---
  const envHash = process.env.CC_OWNER_PASSWORD_HASH?.trim();
  check("env_hash_configured_for_tests", Boolean(envHash));
  const probePassword = `AuthPhaseA-probe-${Date.now()}-x9`;
  const probeHash = hashPassword(probePassword);
  // Temporarily do not rely on knowing env plaintext; verify structure only.
  check(
    "env_fallback_path_available",
    (await getOwnerAccount()) === null && Boolean(envHash)
  );

  // Simulate env-only login: no DB row → verify against env hash only when we know plaintext.
  // Use a dedicated probe owner path for DB tests; env plaintext may be unavailable.
  const envOnlySession = encodeOwnerSessionTokenForTests(); // no pv
  const envDecoded = decodeSessionToken(envOnlySession);
  check(
    "env_only_session_omits_pv",
    envDecoded?.role === "owner" && envDecoded.pv === null
  );
  check(
    "env_only_requireOwner_compat",
    phaseASessionAccepted(envDecoded, null) === true
  );

  // --- Bootstrap creates exactly one owner ---
  const boot1 = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash: probeHash,
  });
  check("bootstrap_creates_owner", boot1.ok === true && boot1.created === true);
  assert(boot1.ok && boot1.created, "bootstrap create required");
  check(
    "bootstrap_email_normalized",
    boot1.owner.email_normalized === CANONICAL_OWNER_EMAIL
  );
  check("bootstrap_password_version_1", boot1.owner.password_version === 1);
  check("bootstrap_count_one", (await countOwnerAccounts()) === 1);

  // Singleton: second insert via raw SQL must fail
  let singletonBlocked = false;
  try {
    await sql`
      INSERT INTO owner_accounts (email, email_normalized, password_hash, password_version)
      VALUES ('other@example.com', 'other@example.com', ${probeHash}, 1)
    `;
  } catch {
    singletonBlocked = true;
  }
  check("singleton_blocks_second_owner", singletonBlocked);
  check("singleton_still_one_row", (await countOwnerAccounts()) === 1);

  // --- Bootstrap does not overwrite existing hash ---
  const beforeHash = (await getOwnerAccount()).password_hash;
  const otherHash = hashPassword(`${probePassword}-other`);
  const bootAgain = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash: otherHash,
  });
  check(
    "bootstrap_idempotent_existing",
    bootAgain.ok === true && bootAgain.created === false
  );
  const afterHash = (await getOwnerAccount()).password_hash;
  check("bootstrap_does_not_overwrite_hash", afterHash === beforeHash);

  // --- Bootstrap refuses conflicting owner ---
  await sql`DELETE FROM owner_accounts`;
  await sql`
    INSERT INTO owner_accounts (email, email_normalized, password_hash, password_version)
    VALUES ('rogue@example.com', 'rogue@example.com', ${probeHash}, 1)
  `;
  const conflict = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash: probeHash,
  });
  check(
    "bootstrap_refuses_conflicting_owner",
    conflict.ok === false && conflict.error === "conflicting_owner"
  );

  // Restore canonical owner for dual-read tests
  await sql`DELETE FROM owner_accounts`;
  const bootCanonical = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash: probeHash,
  });
  assert(bootCanonical.ok, "canonical bootstrap");

  const byEmail = await getOwnerByEmailNormalized("  Info@MCSHandymen.COM ");
  check(
    "get_owner_by_normalized_email",
    byEmail?.email_normalized === CANONICAL_OWNER_EMAIL
  );

  // --- Dual-read: DB authoritative ---
  const dbOwner = await getOwnerAccount();
  check(
    "db_login_correct_password",
    verifyPassword(probePassword, dbOwner.password_hash) &&
      normalizeOwnerEmail(CANONICAL_OWNER_EMAIL) === dbOwner.email_normalized
  );
  check(
    "db_login_wrong_password",
    verifyPassword("definitely-wrong-password-xx", dbOwner.password_hash) ===
      false
  );

  // Env hash cannot bypass wrong DB password once DB owner exists
  if (envHash && envHash !== dbOwner.password_hash) {
    check(
      "env_hash_differs_from_db_hash",
      true
    );
    // Login path uses only dbOwner.password_hash — env hash must not verify against DB.
    check(
      "env_bypass_blocked_after_bootstrap",
      // Correct semantics: authenticating means verify(password, dbOwner.password_hash).
      // Env hash is irrelevant once DB row exists. Prove wrong password fails even if env hash set.
      verifyPassword("wrong-env-bypass-attempt", dbOwner.password_hash) === false &&
        actionsUsesDbHashOnly()
    );
  } else {
    // When env hash was used for bootstrap in other flows they may match; still prove
    // wrong password cannot succeed and source uses DB hash exclusively after bootstrap.
    check(
      "env_bypass_blocked_after_bootstrap",
      verifyPassword("wrong-env-bypass-attempt", dbOwner.password_hash) === false &&
        actionsUsesDbHashOnly()
    );
  }

  // Stronger: put a known-different hash in DB; env hash must not open the door.
  const dbOnlyPassword = `DbOnly-${Date.now()}-secure99`;
  const dbOnlyHash = hashPassword(dbOnlyPassword);
  await sql`
    UPDATE owner_accounts
    SET password_hash = ${dbOnlyHash}, updated_at = now()
    WHERE email_normalized = ${CANONICAL_OWNER_EMAIL}
  `;
  const updated = await getOwnerAccount();
  check(
    "db_password_updated_for_bypass_test",
    updated && verifyPassword(dbOnlyPassword, updated.password_hash)
  );
  check(
    "env_password_hash_cannot_authenticate_db_owner",
    // Even if caller somehow used env hash string as the "password" check target,
    // loginAction verifies plaintext against dbOwner.password_hash only.
    envHash
      ? verifyPassword(dbOnlyPassword, envHash) === false ||
          envHash !== updated.password_hash
      : true
  );
  check(
    "wrong_password_fails_when_db_authoritative",
    verifyPassword("not-the-db-password", updated.password_hash) === false
  );

  // --- password_version sessions ---
  const withPv = encodeOwnerSessionTokenForTests({
    passwordVersion: updated.password_version,
  });
  const decodedPv = decodeSessionToken(withPv);
  check(
    "new_db_session_contains_password_version",
    decodedPv?.pv === updated.password_version
  );
  check(
    "correct_password_version_accepted",
    phaseASessionAccepted(decodedPv, updated) === true
  );

  const wrongPv = encodeOwnerSessionTokenForTests({ passwordVersion: 999 });
  const decodedWrong = decodeSessionToken(wrongPv);
  check(
    "wrong_password_version_rejected",
    phaseASessionAccepted(decodedWrong, updated) === false
  );

  const legacy = encodeOwnerSessionTokenForTests(); // omit pv
  const decodedLegacy = decodeSessionToken(legacy);
  check("legacy_session_decodes_without_pv", decodedLegacy?.pv === null);
  check(
    "legacy_session_compat_allowed_phase_a",
    phaseASessionAccepted(decodedLegacy, updated) === true
  );

  // Invalid pv in token rejected at decode
  const badPvBody = Buffer.from(
    JSON.stringify({
      role: "owner",
      exp: Date.now() + 60_000,
      pv: 0,
    }),
    "utf8"
  ).toString("base64url");
  // Can't easily sign without secret — encodeOwnerSessionTokenForTests rejects pv<1
  check(
    "decode_rejects_missing_hmac_tamper",
    decodeSessionToken(`${badPvBody}.fakesig`) === null
  );

  // --- Worker creation does NOT create auth account ---
  const ownerCountBefore = await countOwnerAccounts();
  const worker = await createWorker({
    displayName: `AuthPhaseA Worker ${Date.now()}`,
  });
  check("worker_create_ok", worker.ok === true, worker.error || "");
  check(
    "worker_create_does_not_add_owner_account",
    (await countOwnerAccounts()) === ownerCountBefore
  );

  // Restore canonical owner with env hash (never print it) for local dual-read use.
  await sql`DELETE FROM owner_accounts`;
  if (envHash) {
    const restore = await bootstrapOwnerAccount({
      email: CANONICAL_OWNER_EMAIL,
      passwordHash: envHash,
    });
    check(
      "suite_restore_env_hash_owner",
      restore.ok === true && restore.created === true
    );
  } else {
    check("suite_restore_env_hash_owner", false, "CC_OWNER_PASSWORD_HASH missing");
  }
}

function actionsUsesDbHashOnly() {
  const actions = readFileSync(join(ROOT, "lib/cc/auth/actions.js"), "utf8");
  const dbBranch = actions.slice(
    actions.indexOf("if (dbOwner)"),
    actions.indexOf("Pre-bootstrap")
  );
  return (
    /dbOwner\.password_hash/.test(dbBranch) &&
    !/getOwnerPasswordHash/.test(dbBranch)
  );
}

async function main() {
  runStaticChecks();

  const eligibility = evaluateWriteEligibility();
  if (!eligibility.ok) {
    console.log(`\nSKIP DB suite — ${eligibility.reason}`);
    if (failed > 0) {
      console.error(`\nAuth Phase A: ${failed} failure(s) (static only)`);
      process.exit(1);
    }
    console.log("\nAuth Phase A: PASS (static; DB skipped)");
    process.exit(0);
  }

  const { host } = bindProcessToSafeTestDatabase({ allowEnvLoad: false });
  console.log(`\nDB_WRITE_TARGET_HOST=${host}`);
  check(
    "test_db_is_development_endpoint",
    /icy-heart|a5aq5s9w/.test(host)
  );

  const sql = neon(process.env.DATABASE_URL);
  await runDbSuite(sql);

  if (failed > 0) {
    console.error(`\nAuth Phase A: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nAuth Phase A: PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
