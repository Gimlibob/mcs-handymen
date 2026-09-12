import Link from "next/link";
import { ArrowRight, List } from "lucide-react";

/**
 * Right rail — only real Phase 3 actions.
 * Kept compact so Needs Attention owns the visual weight.
 */
export default function DashboardSideRail() {
  return (
    <aside className="xl:sticky xl:top-6">
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2">
          <List aria-hidden="true" className="h-4 w-4 text-gold-bright" strokeWidth={1.75} />
          <h2 className="font-heading text-sm font-semibold text-foreground">Quick Actions</h2>
        </div>
        <Link
          href="/command-center/leads"
          className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-gold hover:text-gold-bright"
        >
          View all leads
          <ArrowRight className="h-4 w-4 text-gold-bright" aria-hidden="true" />
        </Link>
      </section>
    </aside>
  );
}
