#!/usr/bin/env node
/**
 * Phase 3 CRM domain + DB checks (no AI).
 */
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import {
  canTransitionLeadStatus,
  getNextAction,
} from "../lib/cc/domain/lead-status.js";
import {
  addLeadNote,
  getLeadActivity,
  getLeadById,
  updateLeadStatus,
} from "../lib/cc/db/leads.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(
    canTransitionLeadStatus("new", "waiting_info") === true,
    "new → waiting_info should be allowed"
  );
  assert(
    canTransitionLeadStatus("new", "completed") === false,
    "new → completed should be rejected"
  );
  assert(
    canTransitionLeadStatus("closed_lost", "new") === false,
    "closed_lost is terminal"
  );
  console.log("PASS — transition rules");

  assert(getNextAction("new") === "Review lead", "next action: new");
  assert(getNextAction("waiting_info") === "Contact customer", "next action: waiting_info");
  assert(
    getNextAction("ready_for_estimate") === "Prepare estimate",
    "next action: ready_for_estimate"
  );
  assert(getNextAction("estimate_sent") === "Follow up", "next action: estimate_sent");
  assert(getNextAction("accepted") === "Schedule job", "next action: accepted");
  assert(getNextAction("closed_won") === null, "next action: closed has none");
  console.log("PASS — next action rules");

  if (!process.env.DATABASE_URL) {
    console.log("SKIP DB checks — no DATABASE_URL");
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  const [lead] = await sql`
    SELECT id, status FROM leads ORDER BY created_at DESC LIMIT 1
  `;
  assert(lead?.id, "Need at least one lead in Neon");

  const original = lead.status;

  // Restore helper: move back if we changed status for test
  const invalid = await updateLeadStatus({
    leadId: lead.id,
    nextStatus: original === "completed" ? "new" : "completed",
  });
  assert(invalid.ok === false && invalid.error === "invalid_transition", "invalid transition rejected");
  console.log("PASS — invalid transition refused by server");

  // Valid transition path depending on current status
  let next = null;
  if (original === "new") next = "waiting_info";
  else if (original === "waiting_info") next = "ready_for_estimate";
  else if (original === "ready_for_estimate") next = "estimate_draft";
  else {
    console.log("SKIP status mutate — lead not on a simple test step:", original);
  }

  if (next) {
    const changed = await updateLeadStatus({ leadId: lead.id, nextStatus: next });
    assert(changed.ok === true, "valid transition should succeed");
    const after = await getLeadById(lead.id);
    assert(after.status === next, "status persisted");
    assert(after.updated_at, "updated_at set");

    // Move back toward original when possible for cleanliness
    if (next === "waiting_info") {
      await updateLeadStatus({ leadId: lead.id, nextStatus: "new" });
    } else if (next === "ready_for_estimate") {
      await updateLeadStatus({ leadId: lead.id, nextStatus: "waiting_info" });
    } else if (next === "estimate_draft") {
      await updateLeadStatus({ leadId: lead.id, nextStatus: "ready_for_estimate" });
    }
    console.log("PASS — valid status change persists");
  }

  const note = await addLeadNote({
    leadId: lead.id,
    body: `Phase 3 test note ${Date.now()}`,
  });
  assert(note.ok === true, "note should save");

  const activity = await getLeadActivity(lead.id);
  assert(
    activity.some((e) => e.event_type === "note_added"),
    "activity should include note_added"
  );
  assert(
    activity.some((e) => e.event_type === "status_changed") || next === null,
    "activity should include status_changed when mutated"
  );
  console.log("PASS — note + activity history");

  console.log("Phase 3 CRM checks finished.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
