"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analyzeLeadAction } from "@/lib/cc/actions/lead-agent";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BulletList({ items, empty = "None listed." }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}

function complexityTone(level) {
  if (level === "high") return "border-red-500/40 text-red-200";
  if (level === "medium") return "border-amber-500/40 text-amber-100";
  return "border-emerald-500/40 text-emerald-100";
}

/**
 * Phase 4A Lead Agent panel — on-demand, read-only vs CRM.
 */
export default function LeadAgentPanel({
  leadId,
  crmNextAction = null,
  latestAnalysis = null,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const analysis =
    latestAnalysis?.analysis && typeof latestAnalysis.analysis === "object"
      ? latestAnalysis.analysis
      : null;

  function onAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeLeadAction(leadId);
      if (!result?.ok) {
        const map = {
          not_configured:
            "Lead Agent is not configured. Set OPENAI_API_KEY (and optional MCS_LEAD_AGENT_MODEL) on the server.",
          unsupported_provider: "Configured AI provider is not supported yet.",
          not_found: "Lead not found.",
          completion_failed: "Analysis request failed. Try again.",
          crm_guard_failed: "Analysis aborted — unexpected CRM change detected.",
        };
        setError(map[result?.error] || "Could not analyze this lead.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Lead Agent Analysis
          </h2>
          <p className="mt-1 text-xs text-muted">
            Read-only · on-demand · does not change status, notes, tags, or CRM Next Action
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={pending}
          className="shrink-0 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
        >
          {pending ? "Analyzing…" : "Analyze Lead"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold-dim/45 bg-surface-2 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            CRM Next Action
          </p>
          <p className="mt-1.5 text-sm font-medium text-gold-bright">
            {crmNextAction || "None (closed)"}
          </p>
          <p className="mt-1 text-[11px] text-muted">Deterministic from lead status</p>
        </div>
        <div className="rounded-xl border border-border-soft bg-surface-2 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            AI Suggested Next Action
          </p>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {analysis?.suggested_next_action || "Run Analyze Lead to generate a suggestion."}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Suggestion only — never auto-applies to CRM
          </p>
        </div>
      </div>

      {!analysis ? (
        <p className="mt-4 text-sm text-muted">
          No saved analysis yet. Click Analyze Lead when you want a structured read-only review.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-xs text-muted">
            Saved {formatDateTime(latestAnalysis.created_at)}
            {latestAnalysis.model ? ` · ${latestAnalysis.provider}/${latestAnalysis.model}` : ""}
            {latestAnalysis.prompt_version ? ` · ${latestAnalysis.prompt_version}` : ""}
            {latestAnalysis.crm_next_action_snapshot
              ? ` · CRM Next Action at run: ${latestAnalysis.crm_next_action_snapshot}`
              : ""}
          </p>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Factual summary</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {analysis.factual_summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Operational complexity</h3>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${complexityTone(
                analysis.operational_complexity
              )}`}
            >
              {analysis.operational_complexity}
            </span>
          </div>
          <p className="text-sm text-muted">{analysis.complexity_rationale}</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">Missing information</h3>
              <BulletList items={analysis.missing_information} />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">Questions to ask</h3>
              <BulletList items={analysis.questions_to_ask} />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">Risks / ambiguities</h3>
              <BulletList items={analysis.risks_and_ambiguities} />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">Uncertainties</h3>
              <BulletList items={analysis.uncertainties} />
            </div>
          </div>

          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">Customer context</h3>
            <p className="mb-2 text-sm text-muted">
              Recurrence:{" "}
              <span className="text-foreground">
                {analysis.customer_context?.recurrence || "unknown"}
              </span>
              {" · "}
              Owner tags are opinions, not absolute truth.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Relevant facts</p>
                <BulletList
                  items={analysis.customer_context?.relevant_facts}
                  empty="No customer facts highlighted."
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Owner tags reflected</p>
                <BulletList
                  items={analysis.customer_context?.owner_tags}
                  empty="No owner tags reflected."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
