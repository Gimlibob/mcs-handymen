import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEAD_STATUSES, getNextAction, statusLabel } from "@/lib/cc/domain/lead-status";
import { getStatusBadgeTone } from "@/lib/cc/ui/status-tone";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSource(source) {
  if (!source) return "—";
  if (source === "website_quote") return "Website";
  return source;
}

export default function LeadsFilters({ q = "", status = "" }) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4 sm:flex-row sm:items-end sm:gap-4 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="leads-q" className="mb-1.5 block text-xs font-medium text-muted">
          Search
        </label>
        <input
          id="leads-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, email, city, service…"
          className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
      </div>
      <div className="sm:w-60">
        <label htmlFor="leads-status" className="mb-1.5 block text-xs font-medium text-muted">
          Status
        </label>
        <select
          id="leads-status"
          name="status"
          defaultValue={status}
          className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 text-sm text-foreground focus:border-gold focus:outline-none"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black hover:bg-gold-bright"
      >
        Apply
      </button>
    </form>
  );
}

export function LeadsTable({ leads = [] }) {
  if (leads.length === 0) {
    return (
      <p className="rounded-2xl border border-border-soft bg-surface p-10 text-center text-base text-muted">
        No leads match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-soft text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            <th className="px-5 py-4 font-semibold">Customer</th>
            <th className="px-5 py-4 font-semibold">City</th>
            <th className="px-5 py-4 font-semibold">Service</th>
            <th className="px-5 py-4 font-semibold">Received</th>
            <th className="px-5 py-4 font-semibold">Status</th>
            <th className="px-5 py-4 font-semibold">Next Action</th>
            <th className="px-5 py-4 font-semibold">Contact</th>
            <th className="px-5 py-4 font-semibold">Source</th>
            <th className="px-5 py-4 font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const nextAction = getNextAction(lead.status);
            return (
              <tr
                key={lead.id}
                className="relative border-b border-border-soft transition-colors last:border-b-0 hover:bg-surface-2/50"
              >
                <td className="px-5 py-4 align-middle">
                  <Link
                    href={`/command-center/leads/${lead.id}`}
                    className="text-[15px] font-medium text-foreground after:absolute after:inset-0 after:z-10"
                  >
                    {lead.full_name}
                  </Link>
                </td>
                <td className="px-5 py-4 align-middle text-[15px] text-muted">{lead.city}</td>
                <td className="px-5 py-4 align-middle text-[15px] text-foreground">
                  {lead.project_type}
                </td>
                <td className="whitespace-nowrap px-5 py-4 align-middle text-sm text-muted">
                  {formatDate(lead.created_at)}
                </td>
                <td className="px-5 py-4 align-middle">
                  <span
                    className={`relative z-20 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeTone(lead.status)}`}
                  >
                    {statusLabel(lead.status)}
                  </span>
                </td>
                <td className="px-5 py-4 align-middle">
                  {nextAction ? (
                    <span className="relative z-20 inline-flex rounded-full border border-gold-dim/55 bg-gold/5 px-2.5 py-1 text-xs font-medium text-gold-bright">
                      {nextAction}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-4 align-middle text-sm text-muted">{lead.contact_method}</td>
                <td className="px-5 py-4 align-middle text-sm text-muted">
                  {formatSource(lead.source)}
                </td>
                <td className="px-5 py-4 align-middle">
                  <span className="relative z-20 inline-flex text-gold-bright" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
