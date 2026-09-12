import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn } from "lucide-react";
import { DASHBOARD_PIPELINE_STAGES, statusLabel } from "@/lib/cc/domain/lead-status";
import { getStatusCountTone } from "@/lib/cc/ui/status-tone";

export default function PipelineStrip({ counts = {} }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] xl:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ChartNoAxesColumn
            aria-hidden="true"
            className="h-5 w-5 text-gold-bright"
            strokeWidth={1.75}
          />
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Pipeline</h2>
            <p className="text-sm text-muted">Where leads sit in the workflow right now.</p>
          </div>
        </div>
        <Link
          href="/command-center/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
        >
          View all leads
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ol className="mt-3.5 flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-0">
        {DASHBOARD_PIPELINE_STAGES.map((status, index) => {
          const count = counts[status] || 0;
          const tone = getStatusCountTone(status, count);
          const isLast = index === DASHBOARD_PIPELINE_STAGES.length - 1;

          return (
            <li key={status} className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-0">
              <Link
                href={`/command-center/leads?status=${encodeURIComponent(status)}`}
                className={`flex min-h-[92px] min-w-0 flex-1 flex-col justify-between rounded-xl border bg-surface-2 px-3.5 py-3.5 transition-colors hover:border-gold/60 ${tone.border}`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${tone.label}`}>
                  {statusLabel(status)}
                </p>
                <p className={`mt-2.5 font-heading text-[1.85rem] font-bold tabular-nums ${tone.number}`}>
                  {count}
                </p>
              </Link>

              {!isLast ? (
                <div
                  aria-hidden="true"
                  className="hidden shrink-0 items-center px-1 text-gold-bright lg:flex"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
