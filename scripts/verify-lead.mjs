#!/usr/bin/env node
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const leadId = process.argv[2];
if (!leadId) {
  console.error("Usage: node scripts/verify-lead.mjs <lead-id>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT
    l.id,
    l.full_name,
    l.email,
    l.status,
    l.source,
    p.blob_pathname
  FROM leads l
  JOIN lead_photos p ON p.lead_id = l.id
  WHERE l.id = ${leadId}
`;

const migrations = await sql`SELECT id FROM schema_migrations ORDER BY id`;

console.log(JSON.stringify({ lead: rows, migrations }, null, 2));
