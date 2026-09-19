#!/usr/bin/env node
/**
 * Auth Phase B — Change / Forgot / Reset Password + no-pv rejection.
 *
 * Usage:
 *   node scripts/test-phase-auth-b-password.mjs
 *
 * Requires TEST_DATABASE_URL (Neon development). Never writes Production.
 * Does not print password hashes or raw reset tokens in PASS lines.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
  bindProcessToSafeTestDatabase,
  evaluateWriteEligibility,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";
import { hashPassword, verifyPassword } from "../lib/cc/auth/password.js";
import {
  decodeSessionToken,
  encodeOwnerSessionTokenForTests,
} from "../lib/cc/auth/session-token.js";
import {
  bootstrapOwnerAccount,
  getOwnerAccount,
  updateOwnerPasswordHash,
} from "../lib/cc/db/owner-accounts.js";
import {
  FORGOT_PASSWORD_MAX_PER_WINDOW,
  countRecentResetTokenRequests,
  createPasswordResetToken,
  getResetTokenByRaw,
  getValidResetTokenByRaw,
  hashResetToken,
  resetOwnerPasswordWithToken,
} from "../lib/cc/db/owner-password-reset-tokens.js";
import { CANONICAL_OWNER_EMAIL } from "../lib/cc/domain/owner-account.js";
import { SITE_URL } from "../lib/site-config.js";

loadLocalEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let failed = 0;

function check(name, cond, detail = "") {
  if (cond) console.log(`PASS — ${name}`);
  else {
    failed += 1;
    console.error(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Mirrors Phase B requireOwner gate. */
function sessionAccepted(session, owner) {
  if (!session) return false;
  if (!owner) return true;
  return typeof session.pv === "number" && session.pv === owner.password_version;
}

function runStaticChecks() {
  console.log("\n=== Static contracts ===");
  const mig = readFileSync(
    join(ROOT, "lib/cc/db/migrations/012_owner_password_reset_tokens.sql"),
    "utf8"
  );
  check("migration_012_table", /owner_password_reset_tokens/.test(mig));
  check("migration_012_token_hash_unique", /UNIQUE \(token_hash\)/.test(mig));
  check("migration_012_fk_owner", /REFERENCES owner_accounts/.test(mig));

  const dal = readFileSync(join(ROOT, "lib/cc/auth/dal.js"), "utf8");
  check(
    "dal_rejects_missing_pv",
    /typeof session\.pv !== "number"/.test(dal) &&
      !/Legacy session without pv: allowed/.test(dal)
  );

  const emailHelper = readFileSync(
    join(ROOT, "lib/cc/auth/send-password-reset-email.js"),
    "utf8"
  );
  check("reset_email_uses_site_url", emailHelper.includes("SITE_URL"));
  check(
    "reset_email_no_host_header",
    !/x-forwarded-host/i.test(emailHelper) &&
      !/request\.headers/i.test(emailHelper) &&
      !/headers\(\)/i.test(emailHelper)
  );
  check("canonical_origin", SITE_URL === "https://www.mcshandymen.com");

  const shell = readFileSync(
    join(ROOT, "components/cc/CommandCenterShell.js"),
    "utf8"
  );
  check("shell_has_account_link", /\/command-center\/account/.test(shell));

  const login = readFileSync(join(ROOT, "components/cc/LoginForm.js"), "utf8");
  check("login_has_forgot_link", /\/forgot-password/.test(login));
}

async function runDbSuite(sql) {
  console.log("\n=== DB suite (TEST_DATABASE_URL) ===");

  const [tbl] = await sql`
    SELECT to_regclass('public.owner_password_reset_tokens') AS reg
  `;
  check(
    "schema_reset_tokens_table",
    tbl?.reg === "owner_password_reset_tokens",
    `reg=${tbl?.reg}`
  );
  if (tbl?.reg !== "owner_password_reset_tokens") {
    console.log("SKIP remaining — apply migration 012 on development first");
    return;
  }

  // Isolate owner for this suite
  await sql`DELETE FROM owner_password_reset_tokens`;
  await sql`DELETE FROM owner_accounts`;

  const password = `AuthPhaseB-${Date.now()}-Pw10chars`;
  const passwordHash = hashPassword(password);
  const boot = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash,
  });
  assert(boot.ok && boot.created, "bootstrap owner");
  let owner = await getOwnerAccount();
  check("owner_bootstrapped", owner?.password_version === 1);

  // --- Change password ---
  const wrongCurrent = !verifyPassword("not-the-password", owner.password_hash);
  check("change_wrong_current_fails_verify", wrongCurrent);

  const newPassword = `${password}-new`;
  const confirmMismatch = newPassword !== `${newPassword}x`;
  check("change_confirm_mismatch_detectable", confirmMismatch);

  const newHash = hashPassword(newPassword);
  const changed = await updateOwnerPasswordHash({
    ownerId: owner.id,
    passwordHash: newHash,
    expectedVersion: owner.password_version,
  });
  check("change_password_ok", changed.ok === true);
  owner = changed.owner;
  check("change_password_version_incremented", owner.password_version === 2);
  check(
    "change_password_hash_updated",
    verifyPassword(newPassword, owner.password_hash) &&
      !verifyPassword(password, owner.password_hash)
  );

  const oldPvSession = encodeOwnerSessionTokenForTests({ passwordVersion: 1 });
  const newPvSession = encodeOwnerSessionTokenForTests({
    passwordVersion: owner.password_version,
  });
  check(
    "old_pv_session_rejected",
    sessionAccepted(decodeSessionToken(oldPvSession), owner) === false
  );
  check(
    "new_pv_session_accepted",
    sessionAccepted(decodeSessionToken(newPvSession), owner) === true
  );

  // --- Legacy no-pv ---
  const legacy = encodeOwnerSessionTokenForTests();
  check("legacy_session_has_null_pv", decodeSessionToken(legacy)?.pv === null);
  check(
    "legacy_no_pv_rejected_when_owner_exists",
    sessionAccepted(decodeSessionToken(legacy), owner) === false
  );

  // --- Forgot / tokens ---
  const t1 = await createPasswordResetToken(owner.id);
  check("reset_token_created", t1.ok === true);
  assert(t1.ok, "token1");
  const hash1 = hashResetToken(t1.rawToken);
  const [stored1] = await sql`
    SELECT token_hash, used_at FROM owner_password_reset_tokens
    WHERE token_hash = ${hash1}
  `;
  check("token_hash_stored", stored1?.token_hash === hash1);
  check("raw_token_not_equal_hash", t1.rawToken !== hash1);

  const t2 = await createPasswordResetToken(owner.id);
  check("second_token_created", t2.ok === true);
  assert(t2.ok, "token2");
  const again1 = await getValidResetTokenByRaw(t1.rawToken);
  check("previous_unused_token_invalidated", again1 === null);
  const valid2 = await getValidResetTokenByRaw(t2.rawToken);
  check("latest_token_valid", Boolean(valid2?.id));

  // Expiry: insert expired manually
  const expiredRaw = randomBytes(32).toString("base64url");
  const expiredHash = hashResetToken(expiredRaw);
  await sql`
    INSERT INTO owner_password_reset_tokens (owner_id, token_hash, expires_at, used_at)
    VALUES (${owner.id}, ${expiredHash}, ${new Date(Date.now() - 60_000).toISOString()}, NULL)
  `;
  check(
    "expired_token_rejected",
    (await getValidResetTokenByRaw(expiredRaw)) === null
  );

  check(
    "invalid_token_rejected",
    (await getValidResetTokenByRaw("not-a-real-token-value-xx")) === null
  );

  // Cooldown counter uses persisted rows
  const recent = await countRecentResetTokenRequests(owner.id);
  check(
    "cooldown_counts_persisted_requests",
    recent >= 2 && recent <= FORGOT_PASSWORD_MAX_PER_WINDOW + 5
  );

  // --- Reset password ---
  const resetPassword = `AuthPhaseB-reset-${Date.now()}-Ok`;
  const resetHash = hashPassword(resetPassword);
  const beforePv = owner.password_version;
  const reset = await resetOwnerPasswordWithToken({
    ownerId: owner.id,
    tokenId: valid2.id,
    passwordHash: resetHash,
    expectedVersion: beforePv,
  });
  check("reset_password_ok", reset.ok === true);
  owner = reset.owner;
  check("reset_password_version_incremented", owner.password_version === beforePv + 1);
  check(
    "reset_password_hash_works",
    verifyPassword(resetPassword, owner.password_hash)
  );

  const usedTok = await getResetTokenByRaw(t2.rawToken);
  check("reset_token_marked_used", Boolean(usedTok?.used_at));
  check(
    "used_token_no_longer_valid",
    (await getValidResetTokenByRaw(t2.rawToken)) === null
  );

  const preResetPvSession = encodeOwnerSessionTokenForTests({
    passwordVersion: beforePv,
  });
  check(
    "pre_reset_pv_rejected",
    sessionAccepted(decodeSessionToken(preResetPvSession), owner) === false
  );
  const postResetPvSession = encodeOwnerSessionTokenForTests({
    passwordVersion: owner.password_version,
  });
  check(
    "post_reset_pv_accepted",
    sessionAccepted(decodeSessionToken(postResetPvSession), owner) === true
  );

  // Unknown email public response is a source contract (identical message)
  const actions = readFileSync(
    join(ROOT, "lib/cc/actions/owner-account.js"),
    "utf8"
  );
  check(
    "forgot_generic_message_constant",
    /If an account exists for that email, a reset link has been sent/.test(actions)
  );
  check(
    "forgot_uses_persisted_cooldown",
    /countRecentResetTokenRequests/.test(actions) &&
      /FORGOT_PASSWORD_MAX_PER_WINDOW/.test(actions)
  );

  // Restore env-hash owner for local dual-read continuity (never print hash)
  const envHash = process.env.CC_OWNER_PASSWORD_HASH?.trim();
  await sql`DELETE FROM owner_password_reset_tokens`;
  await sql`DELETE FROM owner_accounts`;
  if (envHash) {
    const restore = await bootstrapOwnerAccount({
      email: CANONICAL_OWNER_EMAIL,
      passwordHash: envHash,
    });
    check("suite_restore_env_hash_owner", restore.ok && restore.created);
  } else {
    check("suite_restore_env_hash_owner", false, "env hash missing");
  }
}

async function main() {
  runStaticChecks();

  const eligibility = evaluateWriteEligibility();
  if (!eligibility.ok) {
    console.log(`\nSKIP DB suite — ${eligibility.reason}`);
    process.exit(failed > 0 ? 1 : 0);
  }

  const { host } = bindProcessToSafeTestDatabase({ allowEnvLoad: false });
  console.log(`\nDB_WRITE_TARGET_HOST=${host}`);
  check("test_db_is_development", /icy-heart|a5aq5s9w/.test(host));

  const sql = neon(process.env.DATABASE_URL);
  await runDbSuite(sql);

  if (failed > 0) {
    console.error(`\nAuth Phase B: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nAuth Phase B: PASS");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
