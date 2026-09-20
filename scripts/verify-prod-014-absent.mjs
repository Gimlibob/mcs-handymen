#!/usr/bin/env node
/** Production READ-ONLY: migration 014 must be ABSENT. */
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import {
  databaseHostFromUrl,
  isProductionDatabaseHost,
} from "./lib/db-write-safety.mjs";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL?.trim();
const host = databaseHostFromUrl(url);
console.log(`HOST=${host}`);
if (!isProductionDatabaseHost(host)) {
  console.error("REFUSED: not Production");
  process.exit(2);
}
const sql = neon(url);
const mig = await sql`
  SELECT id FROM schema_migrations WHERE id = '014_google_calendar_sync.sql'
`;
const tbl = await sql`
  SELECT to_regclass('public.google_calendar_connections') AS t
`;
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='jobs'
    AND column_name IN ('google_event_id','google_sync_status')
`;
console.log(`MIGRATION_014_COUNT=${mig.length}`);
console.log(`CONNECTIONS_TABLE=${tbl[0]?.t || "ABSENT"}`);
console.log(`GOOGLE_JOB_COLS=${cols.length}`);
const ok = mig.length === 0 && !tbl[0]?.t && cols.length === 0;
console.log(ok ? "PROD_014_ABSENT=PASS" : "PROD_014_ABSENT=FAIL");
process.exit(ok ? 0 : 1);
