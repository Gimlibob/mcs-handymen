import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getNextAction, statusLabel } from "@/lib/cc/domain/lead-status";
import { getStatusBadgeTone } from "@/lib/cc/ui/status-tone";

function formatUpdated(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NeedsAttentionList({ items = [] }) {
  return (
    <section className="flex h-full min-h-[200px] flex-col rounded-2xl border border-border-soft border-l-4 border-l-red-500 bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] xl:min-h-0 xl:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-red-400"
            strokeWidth={1.75}
          />
          <div>
            <h2 className="font-heading text-lg font-semibold text-red-400">Needs Attention</h2>
            <p className="text-sm text-muted">Deterministic queue — review these leads next.</p>
          </div>
        </div>
        <p className="rounded-full border border-red-500/35 bg-red-950/25 px-3 py-1 text-sm font-semibold text-red-300 tabular-nums">
          {items.length} {items.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Nothing needs attention right now.</p>
      ) : (
        <div className="mt-3.5 flex-1 overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-soft text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                <th className="pb-2.5 pr-3 font-semibold">Customer</th>
                <th className="pb-2.5 pr-3 font-semibold">City</th>
                <th className="pb-2.5 pr-3 font-semibold">Status</th>
                <th className="pb-2.5 pr-3 font-semibold">Next Action</th>
                <th className="pb-2.5 pr-2 font-semibold">Updated</th>
                <th className="pb-2.5 font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const nextAction = getNextAction(item.status) || item.reasonLabel;
                return (
                  <tr
                    key={`${item.leadId}-${item.reason}`}
                    className="border-b border-border-soft last:border-b-0"
                  >
                    <td className="py-3 pr-3 align-middle">
                      <Link
                        href={`/command-center/leads/${item.leadId}`}
                        className="text-[15px] font-medium text-foreground hover:text-gold-bright"
                      >
                        {item.fullName}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 align-middle text-[15px] text-muted">
                      {item.city || "—"}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeTone(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <span className="inline-flex rounded-full border border-gold-dim/55 bg-gold/5 px-2.5 py-1 text-xs font-medium text-gold-bright">
                        {nextAction}
                      </span>
                    </td>
                    <td className="py-3 pr-2 align-middle text-sm text-muted">
                      {formatUpdated(item.at)}
                    </td>
                    <td className="py-3 align-middle">
                      <Link
                        href={`/command-center/leads/${item.leadId}`}
                        className="inline-flex text-gold-bright hover:opacity-80"
                        aria-label={`Open ${item.fullName}`}
                      >
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
