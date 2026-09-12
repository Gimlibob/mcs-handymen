import { isTerminalStatus, statusLabel } from "./lead-status.js";

const STALE_DAYS = 3;

/**
 * Deterministic "Needs Attention" rules (no AI).
 * Returns prioritized items with reason codes.
 */
export function buildNeedsAttention(leads, { now = new Date(), staleDays = STALE_DAYS } = {}) {
  const cutoff = now.getTime() - staleDays * 24 * 60 * 60 * 1000;
  const items = [];

  for (const lead of leads) {
    const updatedAt = lead.updated_at ? new Date(lead.updated_at).getTime() : 0;
    const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;

    if (lead.status === "new") {
      items.push({
        leadId: lead.id,
        fullName: lead.full_name,
        city: lead.city,
        status: lead.status,
        reason: "new_lead",
        reasonLabel: "New lead — review and classify",
        priority: 10,
        at: createdAt,
      });
    }

    if (lead.status === "waiting_info") {
      items.push({
        leadId: lead.id,
        fullName: lead.full_name,
        city: lead.city,
        status: lead.status,
        reason: "waiting_info",
        reasonLabel: "Waiting on customer information",
        priority: 20,
        at: updatedAt || createdAt,
      });
    }

    if (lead.status === "estimate_pending_review") {
      items.push({
        leadId: lead.id,
        fullName: lead.full_name,
        city: lead.city,
        status: lead.status,
        reason: "estimate_pending_review",
        reasonLabel: "Estimate waiting for your review",
        priority: 15,
        at: updatedAt || createdAt,
      });
    }

    if (
      !isTerminalStatus(lead.status) &&
      updatedAt > 0 &&
      updatedAt < cutoff &&
      lead.status !== "new" // already covered
    ) {
      items.push({
        leadId: lead.id,
        fullName: lead.full_name,
        city: lead.city,
        status: lead.status,
        reason: "stale",
        reasonLabel: `No action for ${staleDays}+ days (${statusLabel(lead.status)})`,
        priority: 30,
        at: updatedAt,
      });
    }
  }

  // Dedupe by leadId+reason, then sort by priority then recency
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = `${item.leadId}:${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  unique.sort((a, b) => a.priority - b.priority || b.at - a.at);
  return unique.slice(0, 20);
}
