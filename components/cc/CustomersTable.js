import Link from "next/link";
import {
  customerRecurrenceLabel,
  getCustomerRecurrence,
} from "@/lib/cc/domain/customer-match";

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

export default function CustomersFilters({ q = "" }) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4 sm:flex-row sm:items-end sm:gap-4 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="customers-q" className="mb-1.5 block text-xs font-medium text-muted">
          Search
        </label>
        <input
          id="customers-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, email, city…"
          className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
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

export function CustomersTable({ customers = [] }) {
  if (customers.length === 0) {
    return (
      <p className="rounded-2xl border border-border-soft bg-surface p-10 text-center text-base text-muted">
        No customers match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-soft text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            <th className="px-5 py-4 font-semibold">Customer</th>
            <th className="px-5 py-4 font-semibold">City</th>
            <th className="px-5 py-4 font-semibold">Email</th>
            <th className="px-5 py-4 font-semibold">Leads</th>
            <th className="px-5 py-4 font-semibold">Type</th>
            <th className="px-5 py-4 font-semibold">Customer since</th>
            <th className="px-5 py-4 font-semibold">Last request</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const leadCount = customer.lead_count ?? 0;
            const recurrence = getCustomerRecurrence(leadCount);
            return (
              <tr key={customer.id} className="border-b border-border-soft/70 hover:bg-surface-2/60">
                <td className="px-5 py-4">
                  <Link
                    href={`/command-center/customers/${customer.id}`}
                    className="font-medium text-gold-bright hover:underline"
                  >
                    {customer.full_name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-foreground">{customer.city || "—"}</td>
                <td className="px-5 py-4 text-sm text-muted">{customer.email}</td>
                <td className="px-5 py-4 text-sm tabular-nums text-foreground">{leadCount}</td>
                <td className="px-5 py-4 text-sm text-foreground">
                  {recurrence === "returning" ? "Returning" : "New"}
                </td>
                <td className="px-5 py-4 text-sm text-muted">{formatDate(customer.created_at)}</td>
                <td className="px-5 py-4 text-sm text-muted">{formatDate(customer.last_lead_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeadCustomerBadge({ summary }) {
  if (!summary?.id) return null;

  const leadCount = summary.lead_count ?? 0;
  const previous = Math.max(leadCount - 1, 0);
  const isReturning = getCustomerRecurrence(leadCount) === "returning";

  return (
    <div className="mt-3 max-w-md rounded-xl border border-border-soft bg-surface-2/80 px-3.5 py-2.5 text-sm">
      <p className="font-medium text-foreground">{customerRecurrenceLabel(leadCount)}</p>
      {isReturning ? (
        <p className="mt-0.5 text-xs text-muted">
          {previous} previous request{previous === 1 ? "" : "s"}
        </p>
      ) : null}
      <Link
        href={`/command-center/customers/${summary.id}`}
        className="mt-1.5 inline-block text-xs font-medium text-gold-bright hover:underline"
      >
        View Customer Profile →
      </Link>
    </div>
  );
}
