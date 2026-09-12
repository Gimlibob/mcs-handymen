/**
 * Visual status tones for Command Center UI only.
 * Does not change CRM rules or transitions.
 */

const GOLD_ACTIVE = new Set([
  "waiting_info",
  "ready_for_estimate",
  "estimate_draft",
  "estimate_pending_review",
  "estimate_sent",
  "accepted",
  "scheduled",
  "in_progress",
  "follow_up",
]);

export const STATUS_SHORT_DESCRIPTIONS = {
  new: "Fresh inbound quotes",
  waiting_info: "Awaiting customer details",
  ready_for_estimate: "Ready to price",
  estimate_draft: "Estimate in progress",
  estimate_pending_review: "Draft needs your review",
  estimate_sent: "Waiting on customer",
  accepted: "Ready to schedule",
  scheduled: "Job on the calendar",
  in_progress: "Work underway",
  completed: "Jobs finished",
  follow_up: "Post-job follow-up",
  closed_won: "Won and closed",
  closed_lost: "Closed without a win",
};

/**
 * @param {string} status
 * @param {number} count
 */
export function getStatusCountTone(status, count = 0) {
  const n = Number(count) || 0;
  const active = n > 0;

  if (status === "closed_lost" || status === "closed_won") {
    return {
      number: "text-muted",
      label: "text-muted",
      desc: "text-muted/80",
      border: "border-border-soft",
      icon: "text-muted",
      card: "bg-surface",
    };
  }

  if (status === "new") {
    return {
      number: active ? "text-red-400" : "text-red-400/45",
      label: active ? "text-red-300" : "text-muted",
      desc: "text-muted",
      border: active ? "border-red-500/45" : "border-border-soft",
      icon: active ? "text-red-400/80" : "text-muted",
      card: "bg-surface",
    };
  }

  if (status === "completed") {
    return {
      number: active ? "text-emerald-400" : "text-emerald-400/45",
      label: active ? "text-emerald-300" : "text-muted",
      desc: "text-muted",
      border: active ? "border-emerald-500/40" : "border-emerald-500/20",
      icon: active ? "text-emerald-400/80" : "text-emerald-400/40",
      card: "bg-surface",
    };
  }

  if (GOLD_ACTIVE.has(status)) {
    return {
      number: active ? "text-gold-bright" : "text-gold-bright/40",
      label: active ? "text-gold-bright/90" : "text-muted",
      desc: "text-muted",
      border: active ? "border-gold-dim/55" : "border-border-soft",
      icon: active ? "text-gold/80" : "text-muted",
      card: "bg-surface",
    };
  }

  return {
    number: active ? "text-foreground" : "text-muted",
    label: "text-muted",
    desc: "text-muted",
    border: "border-border-soft",
    icon: "text-muted",
    card: "bg-surface",
  };
}

/** Badge styles for Needs Attention / tables. */
export function getStatusBadgeTone(status) {
  if (status === "new") {
    return "border-red-500/45 bg-red-950/30 text-red-300";
  }
  if (status === "completed") {
    return "border-emerald-500/40 bg-emerald-950/20 text-emerald-300";
  }
  if (status === "closed_lost" || status === "closed_won") {
    return "border-border-soft bg-surface-2 text-muted";
  }
  if (GOLD_ACTIVE.has(status)) {
    return "border-gold-dim/50 bg-gold/5 text-gold-bright";
  }
  return "border-border-soft bg-surface-2 text-foreground";
}
