#!/usr/bin/env node
/**
 * Reconcile Development schema to amended GC-2 migration 014.
 * TEST_DATABASE_URL only. Never Production.
 *
 * Idempotent ALTERs for Dev DBs that already applied the GC-1-shaped 014.
 */
import { neon } from "@neondatabase/serverless";
import {
  assertSafeTestDatabaseUrl,
  bindProcessToSafeTestDatabase,
} from "./lib/db-write-safety.mjs";

const { host } = bindProcessToSafeTestDatabase();
console.log(`reconcile_014_target host=${host}`);
assertSafeTestDatabaseUrl({ allowEnvLoad: false });

const sql = neon(process.env.DATABASE_URL);

async function columnInfo(name) {
  const rows = await sql`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'google_calendar_connections'
      AND column_name = ${name}
  `;
  return rows[0] || null;
}

// Ensure table exists (fresh Dev)
await sql`
  CREATE TABLE IF NOT EXISTS google_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_account_email TEXT NOT NULL,
    google_account_sub TEXT NULL,
    calendar_id TEXT NULL,
    refresh_token_ciphertext TEXT NULL,
    scopes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    last_error TEXT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    token_updated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

// Add missing columns
await sql`ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS google_account_sub TEXT NULL`;
await sql`ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS scopes TEXT NULL`;

// calendar_id nullable
const cal = await columnInfo("calendar_id");
if (cal && cal.is_nullable === "NO") {
  await sql`ALTER TABLE google_calendar_connections ALTER COLUMN calendar_id DROP NOT NULL`;
  console.log("altered calendar_id → NULLABLE");
} else {
  console.log("calendar_id already nullable or pending");
}

// refresh_token nullable (disconnect clears it)
const tok = await columnInfo("refresh_token_ciphertext");
if (tok && tok.is_nullable === "NO") {
  await sql`ALTER TABLE google_calendar_connections ALTER COLUMN refresh_token_ciphertext DROP NOT NULL`;
  console.log("altered refresh_token_ciphertext → NULLABLE");
}

// Drop and recreate status CHECK
await sql`
  ALTER TABLE google_calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_status_valid
`;
await sql`
  ALTER TABLE google_calendar_connections
  ADD CONSTRAINT google_calendar_connections_status_valid CHECK (
    status IN ('connected', 'disconnected', 'revoked', 'error')
  )
`;
console.log("status CHECK reconciled");

// Ensure jobs google columns + check (idempotent)
await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_event_id TEXT NULL`;
await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_sync_status TEXT NULL`;
await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMPTZ NULL`;
await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_sync_error TEXT NULL`;
await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_sync_attempts INT NOT NULL DEFAULT 0`;
await sql`ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_google_sync_status_valid`;
await sql`
  ALTER TABLE jobs
  ADD CONSTRAINT jobs_google_sync_status_valid CHECK (
    google_sync_status IS NULL
    OR google_sync_status IN ('none','pending','synced','error','missing_remote')
  )
`;

// Ensure schema_migrations records 014
await sql`
  INSERT INTO schema_migrations (id)
  VALUES ('014_google_calendar_sync.sql')
  ON CONFLICT (id) DO NOTHING
`;

const cal2 = await columnInfo("calendar_id");
const sub = await columnInfo("google_account_sub");
const scopes = await columnInfo("scopes");
console.log(
  `VERIFY calendar_id_nullable=${cal2?.is_nullable} sub=${Boolean(sub)} scopes=${Boolean(scopes)}`
);
console.log("RECONCILE_014=PASS");
