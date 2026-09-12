#!/usr/bin/env node
/**
 * Verify every lead has customer_id after 003 backfill.
 * If orphans === 0, optionally apply deferred NOT NULL constraint.
 *
 * Usage:
 *   node scripts/cc-verify-customer-backfill.mjs
 *   node scripts/cc-verify-customer-backfill.mjs --apply-not-null
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_ID = "004_leads_customer_id_not_null.sql";
const applyNotNull = process.argv.includes("--apply-not-null");

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = neon(url);

  const [totals] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM leads) AS lead_count,
      (SELECT COUNT(*)::int FROM leads WHERE customer_id IS NULL) AS orphan_count,
      (SELECT COUNT(*)::int FROM customers) AS customer_count
  `;

  console.log(`leads=${totals.lead_count} customers=${totals.customer_count} orphans=${totals.orphan_count}`);

  if (totals.orphan_count > 0) {
    console.error("FAIL — orphan leads remain. STOP before NOT NULL.");
    process.exit(1);
  }

  console.log("PASS — orphan leads = 0");

  if (!applyNotNull) {
    console.log("Skip NOT NULL (pass --apply-not-null to enforce).");
    return;
  }

  const applied = await sql`SELECT id FROM schema_migrations WHERE id = ${MIGRATION_ID}`;
  if (applied.length > 0) {
    console.log(`skip  ${MIGRATION_ID} (already applied)`);
    return;
  }

  const deferredPath = join(
    __dirname,
    "..",
    "lib",
    "cc",
    "db",
    "migrations",
    "deferred",
    MIGRATION_ID
  );
  const body = readFileSync(deferredPath, "utf8");
  const statements = body
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((line) => line.trim().startsWith("--")));

  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`INSERT INTO schema_migrations (id) VALUES (${MIGRATION_ID})`;
  console.log(`done  ${MIGRATION_ID}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
