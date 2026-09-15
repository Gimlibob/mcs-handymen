#!/usr/bin/env node
/**
 * Phase 2 persistence checks (no AI).
 *
 * A) Invalid DATABASE_URL → safePersist never throws
 * B) Valid Neon TEST_DATABASE_URL → lead + private photo pathname written
 *
 * Usage:
 *   node scripts/test-phase2-persist.mjs
 */
import {
  bindProcessToSafeTestDatabase,
  loadLocalEnv,
} from "./lib/db-write-safety.mjs";

loadLocalEnv();

const sampleLead = {
  fullName: "Phase2 Test Customer",
  email: "phase2-test@example.com",
  city: "Manvel",
  propertyType: "Home",
  projectType: "TV Mounting",
  description: "Phase 2 persistence test — mount a 55 inch TV on drywall.",
  contactMethod: "Email",
  preferredDate: "2026-09-20",
  photos: [
    {
      pathname: `quote-requests/phase2-test-${Date.now()}.jpg`,
      contentType: "image/jpeg",
      size: 12345,
    },
  ],
};

async function testBrokenDatabaseUrl() {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://invalid:invalid@127.0.0.1:1/nonexistent?sslmode=require";

  const { safePersistQuoteLead } = await import(
    `../lib/cc/db/persist-quote-lead.js?broken=${Date.now()}`
  );

  let threw = false;
  let result;
  try {
    result = await safePersistQuoteLead(sampleLead);
  } catch {
    threw = true;
  }

  if (previous === undefined || previous === null || previous === "") {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previous;
  }

  if (threw) {
    throw new Error("TEST A FAILED: safePersistQuoteLead threw with invalid DATABASE_URL");
  }
  if (result?.ok === true) {
    throw new Error("TEST A FAILED: expected persistence not to succeed with invalid DATABASE_URL");
  }

  console.log("PASS A — invalid DATABASE_URL does not throw; result:", result);
  return result;
}

async function testValidDatabaseUrl() {
  const { host } = bindProcessToSafeTestDatabase();
  console.log(`DB_WRITE_TARGET_HOST=${host}`);
  const url = process.env.DATABASE_URL;

  const { neon } = await import("@neondatabase/serverless");
  const { persistQuoteLead } = await import(
    `../lib/cc/db/persist-quote-lead.js?ok=${Date.now()}`
  );

  const result = await persistQuoteLead(sampleLead);
  if (!result?.ok || !result.leadId) {
    throw new Error(`TEST B FAILED: unexpected result ${JSON.stringify(result)}`);
  }

  const sql = neon(url);
  const rows = await sql`
    SELECT l.id, l.full_name, l.status, p.blob_pathname
    FROM leads l
    JOIN lead_photos p ON p.lead_id = l.id
    WHERE l.id = ${result.leadId}
  `;

  if (!rows[0]) {
    throw new Error("TEST B FAILED: lead/photo row missing after persist");
  }
  if (String(rows[0].blob_pathname).startsWith("http")) {
    throw new Error("TEST B FAILED: photo must be a private blob pathname, not a URL");
  }

  console.log("PASS B — lead persisted with private photo pathname:", result.leadId);
  return { leadId: result.leadId };
}

async function main() {
  await testBrokenDatabaseUrl();
  await testValidDatabaseUrl();
  console.log("Phase 2 persistence script finished.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
