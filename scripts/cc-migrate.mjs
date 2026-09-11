#!/usr/bin/env node
/**
 * Apply pending SQL migrations in lib/cc/db/migrations/
 *
 * Usage:
 *   node scripts/cc-migrate.mjs
 *
 * Requires DATABASE_URL (Neon Postgres connection string).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "lib", "cc", "db", "migrations");

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local or the environment.");
    process.exit(1);
  }
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
  const sql = neon(getDatabaseUrl());

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
      // schema_migrations CREATE is idempotent; migration file may include it.
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
