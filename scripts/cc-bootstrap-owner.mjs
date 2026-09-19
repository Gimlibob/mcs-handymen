#!/usr/bin/env node
/**
 * Controlled owner account bootstrap (Auth Phase A).
 *
 * Creates the singleton Command Center owner from:
 *   email: info@mcshandymen.com (canonical)
 *   password hash: CC_OWNER_PASSWORD_HASH (never printed)
 *
 * Usage (development only):
 *   node scripts/cc-bootstrap-owner.mjs --test
 *
 * Does not run during Next build or page load.
 * Does not overwrite an existing owner password hash.
 * Refuses Production unless ALLOW_PROD_OWNER_BOOTSTRAP=1 (not used in Phase A).
 */
import {
  assertSafeTestDatabaseUrl,
  databaseHostFromUrl,
  isProductionDatabaseHost,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";
import { bootstrapOwnerAccount, getOwnerAccount } from "../lib/cc/db/owner-accounts.js";
import { CANONICAL_OWNER_EMAIL } from "../lib/cc/domain/owner-account.js";
import { getOwnerPasswordHash } from "../lib/cc/auth/password.js";

loadLocalEnv();

const args = new Set(process.argv.slice(2));
const useTest = args.has("--test");

async function main() {
  let databaseUrl;
  if (useTest) {
    const resolved = assertSafeTestDatabaseUrl({ allowEnvLoad: false });
    databaseUrl = resolved.url;
    console.log(`bootstrap_target=TEST_DATABASE_URL host=${resolved.host}`);
  } else {
    databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      console.error("DATABASE_URL missing. For development use: --test");
      process.exit(1);
    }
    const host = databaseHostFromUrl(databaseUrl);
    if (isProductionDatabaseHost(host)) {
      if (process.env.ALLOW_PROD_OWNER_BOOTSTRAP?.trim() !== "1") {
        console.error(
          "REFUSED: owner bootstrap against Production requires ALLOW_PROD_OWNER_BOOTSTRAP=1"
        );
        process.exit(1);
      }
      console.log(`bootstrap_target=DATABASE_URL host=${host} (ALLOW_PROD_OWNER_BOOTSTRAP=1)`);
    } else {
      console.log(`bootstrap_target=DATABASE_URL host=${host || "(unknown)"}`);
    }
  }

  process.env.DATABASE_URL = databaseUrl;

  const passwordHash = getOwnerPasswordHash();
  if (!passwordHash) {
    console.error("CC_OWNER_PASSWORD_HASH is not configured.");
    process.exit(1);
  }

  console.log(`canonical_email=${CANONICAL_OWNER_EMAIL}`);

  const before = await getOwnerAccount();
  const result = await bootstrapOwnerAccount({
    email: CANONICAL_OWNER_EMAIL,
    passwordHash,
  });

  if (!result.ok) {
    console.error(`bootstrap_failed error=${result.error}`);
    process.exit(1);
  }

  console.log(
    result.created
      ? `bootstrap_created owner_id=${result.owner.id}`
      : `bootstrap_existing owner_id=${result.owner.id} (hash not overwritten)`
  );
  console.log(`email_normalized=${result.owner.email_normalized}`);
  console.log(`password_version=${result.owner.password_version}`);
  console.log(`had_prior_row=${Boolean(before)}`);
  // Never print password_hash.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
