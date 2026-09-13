#!/usr/bin/env node
/**
 * Phase 4A.5.a — Playbook foundation acceptance tests.
 *
 * Usage:
 *   node scripts/test-phase4a5a-playbook.mjs
 *
 * No UI, no Lead Agent wiring, no business-rule seed.
 */
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import {
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_REVISION_STATUSES,
  PLAYBOOK_SENSITIVITIES,
  PLAYBOOK_VALIDATION_STATES,
  isValidPlaybookCategory,
  isValidPlaybookRevisionStatus,
  normalizePlaybookSlug,
} from "../lib/cc/domain/playbook.js";
import {
  assertRevisionStatusTransitionAllowed,
  createPlaybookDraftRevision,
  createPlaybookEntry,
  getPlaybookEntryById,
  getPlaybookRevisionById,
  listPlaybookRevisionsForEntry,
} from "../lib/cc/db/playbook.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const results = [];

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  // --- Migration ---
  const mig = await sql`
    SELECT id FROM schema_migrations WHERE id = '006_playbook.sql'
  `;
  check("migration_006_applied", mig.length === 1);

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('playbook_entries', 'playbook_revisions')
    ORDER BY table_name
  `;
  check(
    "playbook_tables_exist",
    tables.length === 2 &&
      tables[0].table_name === "playbook_entries" &&
      tables[1].table_name === "playbook_revisions"
  );

  // Existing stores untouched by this migration's presence
  for (const name of ["leads", "customers", "ai_lead_analyses", "lead_notes", "customer_notes"]) {
    const t = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
      LIMIT 1
    `;
    check(`schema_intact_${name}`, t.length === 1);
  }

  // No accidental sources/candidates in 4A.5.a
  const deferred = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('playbook_sources', 'playbook_candidates', 'playbook_revision_sources')
  `;
  check("no_sources_candidates_tables_yet", deferred.length === 0);

  // --- Domain ---
  check("categories_catalog_size", PLAYBOOK_CATEGORIES.length === 15);
  check("sensitivities_catalog_size", PLAYBOOK_SENSITIVITIES.length === 4);
  check("validation_states_size", PLAYBOOK_VALIDATION_STATES.length === 3);
  check(
    "revision_statuses",
    PLAYBOOK_REVISION_STATUSES.join(",") === "draft,approved,retired"
  );
  check("rejects_unknown_category", isValidPlaybookCategory("random_rule") === false);
  check("accepts_commercial_policy", isValidPlaybookCategory("commercial_policy") === true);
  check("slug_normalize", normalizePlaybookSlug("  Min Service Call ") === "min-service-call");
  check(
    "approved_not_silently_to_draft",
    assertRevisionStatusTransitionAllowed("approved", "draft") === false
  );
  check(
    "draft_may_become_approved_later",
    assertRevisionStatusTransitionAllowed("draft", "approved") === true
  );
  check("invalid_status_rejected", isValidPlaybookRevisionStatus("published") === false);

  // --- CRM / AI row counts before playbook writes ---
  const [leadsBefore] = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  const [customersBefore] = await sql`SELECT COUNT(*)::int AS count FROM customers`;
  const [aiBefore] = await sql`SELECT COUNT(*)::int AS count FROM ai_lead_analyses`;

  // --- Create entry ---
  const stamp = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const created = await createPlaybookEntry({
    slug: `test-4a5a-${stamp}`,
    category: "lead_qualification",
    title: `Phase 4A.5.a test entry ${stamp}`,
    serviceKeys: ["general_handyman"],
    tags: ["test", "foundation"],
    sensitivity: "operational",
    validationState: "discussion",
    createdBy: "test",
  });
  check("create_entry_ok", created.ok === true && !!created.entry?.id, created.error || "");
  check(
    "entry_is_discussion_not_auto_validated",
    created.entry?.validation_state === "discussion"
  );
  check(
    "entry_has_no_approved_revision_yet",
    created.entry?.current_approved_revision_id == null
  );

  const badCategory = await createPlaybookEntry({
    slug: `bad-cat-${stamp}`,
    category: "not_a_real_category",
    title: "Bad",
    sensitivity: "operational",
    validationState: "hypothesis",
  });
  check("reject_invalid_category", badCategory.ok === false && badCategory.error === "invalid_category");

  const dup = await createPlaybookEntry({
    slug: `test-4a5a-${stamp}`,
    category: "service_area",
    title: "Dup slug",
    sensitivity: "commercial",
    validationState: "hypothesis",
  });
  check("reject_duplicate_slug", dup.ok === false && dup.error === "slug_taken");

  // --- Draft revision ---
  const draft = await createPlaybookDraftRevision({
    entryId: created.entry.id,
    summary: "Placeholder draft — not an MCS business rule seed.",
    bodyMd: "Test draft body for schema/foundation only.",
    structuredFields: { purpose: "schema_test" },
    changeNote: "4A.5.a foundation test",
    createdBy: "test",
  });
  check("create_draft_ok", draft.ok === true && draft.revision?.status === "draft", draft.error || "");
  check("draft_version_starts_at_1", draft.revision?.version === 1);
  check("draft_has_no_approved_at", draft.revision?.approved_at == null);

  const draft2 = await createPlaybookDraftRevision({
    entryId: created.entry.id,
    summary: "Second draft",
    bodyMd: "Another draft — approved content not edited in place.",
    supersedesRevisionId: draft.revision.id,
    createdBy: "test",
  });
  check("second_draft_version_2", draft2.ok === true && draft2.revision?.version === 2);
  check(
    "second_draft_supersedes_first",
    draft2.revision?.supersedes_revision_id === draft.revision.id
  );

  const revisions = await listPlaybookRevisionsForEntry(created.entry.id);
  check("list_revisions_count", revisions.length === 2);

  const reloaded = await getPlaybookEntryById(created.entry.id);
  check("entry_reload_ok", reloaded?.id === created.entry.id);
  const revReloaded = await getPlaybookRevisionById(draft.revision.id);
  check("revision_reload_status_draft", revReloaded?.status === "draft");

  // DB rejects invalid status if forced (constraint)
  let statusConstraintOk = false;
  try {
    await sql`
      UPDATE playbook_revisions
      SET status = 'published'
      WHERE id = ${draft.revision.id}
    `;
  } catch {
    statusConstraintOk = true;
  }
  check("db_rejects_invalid_revision_status", statusConstraintOk);

  // Unique approved index exists (query pg_indexes)
  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'playbook_revisions_one_approved_per_entry_idx'
  `;
  check("one_approved_per_entry_index", idx.length === 1);

  // --- Isolation: playbook writes did not mutate CRM / AI counts ---
  const [leadsAfter] = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  const [customersAfter] = await sql`SELECT COUNT(*)::int AS count FROM customers`;
  const [aiAfter] = await sql`SELECT COUNT(*)::int AS count FROM ai_lead_analyses`;
  check("leads_count_unchanged", leadsAfter.count === leadsBefore.count);
  check("customers_count_unchanged", customersAfter.count === customersBefore.count);
  check("ai_lead_analyses_count_unchanged", aiAfter.count === aiBefore.count);

  // No MCS $125 seed inserted by this phase
  const [seeded] = await sql`
    SELECT COUNT(*)::int AS count
    FROM playbook_entries
    WHERE slug IN ('minimum-service-call', 'min-service-call', 'min-service-call-usd')
       OR title ILIKE '%125%'
  `;
  check("no_auto_seed_min_service_call", seeded.count === 0, `count=${seeded.count}`);

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Phase 4A.5.a summary ---");
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
