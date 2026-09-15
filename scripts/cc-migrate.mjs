#!/usr/bin/env node
/**
 * Apply pending SQL migrations in lib/cc/db/migrations/
 *
 * Usage:
 *   node scripts/cc-migrate.mjs --test
 *     → uses TEST_DATABASE_URL (Neon development). Refuses Production.
 *
 *   ALLOW_PROD_MIGRATE=1 node scripts/cc-migrate.mjs
 *     → uses DATABASE_URL only when explicitly allowed (Production opt-in).
 *
 * Without --test or ALLOW_PROD_MIGRATE=1, Production DATABASE_URL is refused.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
  assertSafeTestDatabaseUrl,
  databaseHostFromUrl,
  isProductionDatabaseHost,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";

loadLocalEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "lib", "cc", "db", "migrations");

const args = new Set(process.argv.slice(2));
const useTest = args.has("--test");

function getDatabaseUrl() {
  if (useTest) {
    const { url, host } = assertSafeTestDatabaseUrl({ allowEnvLoad: false });
    console.log(`migrate_target=TEST_DATABASE_URL host=${host}`);
    return url;
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "DATABASE_URL is not set. For development migrations use: node scripts/cc-migrate.mjs --test"
    );
    process.exit(1);
  }

  const host = databaseHostFromUrl(url);
  if (isProductionDatabaseHost(host)) {
    if (process.env.ALLOW_PROD_MIGRATE?.trim() !== "1") {
      console.error(
        "REFUSED: database writes are not allowed against Production.\n" +
          "Use: node scripts/cc-migrate.mjs --test\n" +
          "Or set ALLOW_PROD_MIGRATE=1 only for an intentional Production migrate."
      );
      process.exit(1);
    }
    console.log(`migrate_target=DATABASE_URL host=${host} (ALLOW_PROD_MIGRATE=1)`);
    return url;
  }

  console.log(`migrate_target=DATABASE_URL host=${host || "(unknown)"}`);
  return url;
}

/** Split SQL file into statements; ignores empty chunks. */
function splitStatements(sqlText) {
  return sqlText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((line) => line.trim().startsWith("--")));
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  const host = databaseHostFromUrl(databaseUrl);
  if (isProductionDatabaseHost(host) && !useTest && process.env.ALLOW_PROD_MIGRATE?.trim() !== "1") {
    console.error("REFUSED: database writes are not allowed against Production.");
    process.exit(1);
  }
  if (useTest && isProductionDatabaseHost(host)) {
    console.error("REFUSED: --test resolved to Production endpoint. Aborting.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql`SELECT id FROM schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.id));

  const files = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }

    const fullPath = join(migrationsDir, file);
    const body = readFileSync(fullPath, "utf8");
    const statements = splitStatements(body);

    console.log(`apply ${file} (${statements.length} statements)`);

    for (const statement of statements) {
      await sql.query(statement);
    }

    await sql`INSERT INTO schema_migrations (id) VALUES (${file})`;
    console.log(`done  ${file}`);
  }

  console.log("Migrations complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
