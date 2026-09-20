#!/usr/bin/env node
/**
 * Production READ-ONLY verify: migration 013 must be ABSENT.
 * Never writes. Uses DATABASE_URL from .env.local (Production).
 */
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import {
  databaseHostFromUrl,
  isProductionDatabaseHost,
} from "./lib/db-write-safety.mjs";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const host = databaseHostFromUrl(url);
console.log(`PROD_READ_HOST=${host}`);
if (!isProductionDatabaseHost(host)) {
  console.error("REFUSED: DATABASE_URL is not Production — aborting verify");
  process.exit(2);
}

const sql = neon(url);

const mig = await sql`
  SELECT id FROM schema_migrations WHERE id = '013_job_scheduling.sql'
`;

let cols = [];
try {
  cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name IN ('scheduled_date', 'scheduled_window')
    ORDER BY column_name
  `;
} catch (e) {
  console.error("column probe failed:", e?.message || e);
  process.exit(1);
}

// Legacy scheduled jobs — only query status (columns absent so cannot select schedule fields)
const legacy = await sql`
  SELECT id, status, authorized_at
  FROM jobs
  WHERE status = 'scheduled'
  ORDER BY authorized_at ASC NULLS LAST
  LIMIT 10
`;

console.log(`MIGRATION_013_COUNT=${mig.length}`);
console.log(`SCHEDULE_COLUMN_COUNT=${cols.length}`);
console.log(`LEGACY_SCHEDULED_JOB_COUNT=${legacy.length}`);
if (legacy[0]) {
  console.log(`LEGACY_FIRST_SCHEDULED_ID=${legacy[0].id}`);
  console.log(`LEGACY_FIRST_STATUS=${legacy[0].status}`);
}

const ok = mig.length === 0 && cols.length === 0;
console.log(ok ? "PROD_013_ABSENT=PASS" : "PROD_013_ABSENT=FAIL");
process.exit(ok ? 0 : 1);
