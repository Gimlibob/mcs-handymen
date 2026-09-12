import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import DashboardStatusTiles from "@/components/cc/DashboardStatusTiles";
import DashboardSideRail from "@/components/cc/DashboardSideRail";
import NeedsAttentionList from "@/components/cc/NeedsAttentionList";
import PipelineStrip from "@/components/cc/PipelineStrip";
import { getLeadStatusCounts, listLeadsForAttention } from "@/lib/cc/db/leads";
import { buildNeedsAttention } from "@/lib/cc/domain/needs-attention";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

export const metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

/**
 * Modular Dashboard sections (Phase 3):
 * 1. KPIs
 * 2. Pipeline
 * 3. Needs Attention + Quick Actions
 * Future (not implemented): Marketing Snapshot — Facebook / Instagram / Google / Website
 * attribution — only when real data exists. Do not invent metrics.
 */
export default async function CommandCenterPage() {
  await requireOwner();

  let counts = {};
  let attentionItems = [];
  let dbError = null;
  const loadedAt = new Date();

  try {
    counts = await getLeadStatusCounts();
    const openLeads = await listLeadsForAttention();
    attentionItems = buildNeedsAttention(openLeads);
  } catch (error) {
    console.error("[cc/dashboard] load failed");
    dbError = "Could not load pipeline data. Check DATABASE_URL and migrations.";
  }

  const lastUpdated = loadedAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <CommandCenterShell pathname="/command-center" showClock fitViewport>
      <div className="flex flex-col gap-4 xl:h-full xl:min-h-0 xl:gap-3.5 xl:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground xl:text-[1.75rem]">
              Dashboard
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Operational pipeline for MCS Handymen. Counts come from Neon — nothing is invented.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto xl:justify-end">
            <form
              action="/command-center/leads"
              method="get"
              className="relative min-w-0 flex-1 xl:w-64"
            >
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <label htmlFor="cc-dash-search" className="sr-only">
                Search leads
              </label>
              <input
                id="cc-dash-search"
                name="q"
                type="search"
                placeholder="Search leads..."
                className="w-full rounded-xl border border-border-soft bg-surface py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </form>

            <p className="hidden shrink-0 text-xs text-muted xl:block">
              Updated{" "}
              <span className="text-foreground/80 tabular-nums">{lastUpdated}</span>
            </p>

            <Link
              href="/command-center/leads"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gold-dim/55 px-3.5 py-2 text-sm font-medium text-gold-bright hover:border-gold"
            >
              View all leads
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {dbError ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {dbError}
          </p>
        ) : (
          <>
            <section aria-label="Status KPIs" className="shrink-0">
              <DashboardStatusTiles counts={counts} />
            </section>

            <section aria-label="Pipeline" className="shrink-0">
              <PipelineStrip counts={counts} />
            </section>

            <section
              aria-label="Needs Attention and actions"
              className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-12"
            >
              <div className="xl:col-span-10 xl:flex xl:min-h-0 xl:flex-col">
                <NeedsAttentionList items={attentionItems} />
              </div>
              <div className="xl:col-span-2">
                <DashboardSideRail />
              </div>
            </section>

            {/*
              Future modular slot — Marketing Snapshot (FB / IG / Google / Website).
              Do not render until real attribution data exists. Never invent metrics.
            */}
          </>
        )}
      </div>
    </CommandCenterShell>
  );
}
