import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { AddCustomerNoteForm, CustomerTagsForm } from "@/components/cc/CustomerActions";
import {
  getCustomerById,
  getCustomerLastActivity,
  getCustomerLeadCount,
  getCustomerNotes,
  getCustomerServices,
  getCustomerTags,
  getCustomerTimeline,
  listCustomerLeads,
} from "@/lib/cc/db/customers";
import {
  customerRecurrenceLabel,
  getCustomerRecurrence,
} from "@/lib/cc/domain/customer-match";
import { customerTagLabel } from "@/lib/cc/domain/customer-tags";
import { getNextAction, statusLabel } from "@/lib/cc/domain/lead-status";
import { getStatusBadgeTone } from "@/lib/cc/ui/status-tone";

export const dynamic = "force-dynamic";

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

function Panel({ title, children, className = "", compact = false }) {
  return (
    <section
      className={`rounded-2xl border border-border-soft bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${
        compact ? "p-4" : "p-5"
      } ${className}`}
    >
      {title ? (
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const customer = await getCustomerById(id);
    if (!customer) return { title: "Customer" };
    return { title: customer.full_name };
  } catch {
    return { title: "Customer" };
  }
}

export default async function CustomerDetailPage({ params }) {
  await requireOwner();
  const { id } = await params;

  let customer;
  try {
    customer = await getCustomerById(id);
  } catch {
    console.error("[cc/customer] load failed");
    throw new Error("Unable to load customer.");
  }

  if (!customer || customer.merged_into_customer_id) notFound();

  const [leadCount, leads, services, notes, tags, lastActivity, timeline] = await Promise.all([
    getCustomerLeadCount(customer.id),
    listCustomerLeads(customer.id),
    getCustomerServices(customer.id),
    getCustomerNotes(customer.id),
    getCustomerTags(customer.id),
    getCustomerLastActivity(customer.id),
    getCustomerTimeline(customer.id),
  ]);

  const recurrence = getCustomerRecurrence(leadCount);
  const tagKeys = tags.map((t) => t.tag_key);

  return (
    <CommandCenterShell pathname={`/command-center/customers/${customer.id}`}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/command-center/customers"
            className="text-sm font-medium text-muted hover:text-gold-bright"
          >
            ← Customers
          </Link>

          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
                  {customer.full_name}
                </h1>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    recurrence === "returning"
                      ? "border-gold-dim/50 bg-gold/10 text-gold-bright"
                      : "border-border-soft bg-surface-2 text-muted"
                  }`}
                >
                  {customerRecurrenceLabel(leadCount)}
                </span>
              </div>
              <p className="mt-2 text-base text-muted">
                {customer.city || "City not set"}
                <span className="mx-2 text-border-soft">·</span>
                Customer since {formatDate(customer.created_at)}
              </p>
            </div>

            <div className="min-w-[220px] rounded-2xl border border-border-soft bg-surface px-5 py-4 xl:max-w-xs">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Requests
              </p>
              <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">
                {leadCount}
              </p>
              <p className="mt-1 text-xs text-muted">
                Last activity {formatDateTime(lastActivity)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <Panel title="Identity" compact>
              <dl className="grid gap-2.5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Name</dt>
                  <dd className="text-foreground">{customer.full_name}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${customer.email}`}
                      className="break-all font-medium text-gold-bright hover:underline"
                    >
                      {customer.email}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">City (current)</dt>
                  <dd className="text-foreground">{customer.city || "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Customer since</dt>
                  <dd className="text-foreground">{formatDate(customer.created_at)}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Services requested" compact>
              {services.length === 0 ? (
                <p className="text-sm text-muted">No services yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {services.map((row) => (
                    <li key={row.project_type}>{row.project_type}</li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Operational tags" compact>
              <CustomerTagsForm customerId={customer.id} selectedKeys={tagKeys} />
            </Panel>
          </div>

          <div className="flex flex-col gap-5 xl:col-span-6">
            <Panel title="Request history">
              {leads.length === 0 ? (
                <p className="text-sm text-muted">No leads linked.</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {leads.map((lead) => {
                    const next = getNextAction(lead.status);
                    return (
                      <li key={lead.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <Link
                            href={`/command-center/leads/${lead.id}`}
                            className="font-medium text-gold-bright hover:underline"
                          >
                            {lead.project_type}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">
                            {lead.city} · {formatDate(lead.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeTone(lead.status)}`}
                          >
                            {statusLabel(lead.status)}
                          </span>
                          {next ? <span className="text-xs text-muted">{next}</span> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Private customer notes">
              <p className="-mt-1 mb-3 text-xs text-muted">
                Permanent customer-level notes — separate from lead notes.
              </p>
              <AddCustomerNoteForm customerId={customer.id} />
              <ul className="cc-scroll mt-4 max-h-64 space-y-2 overflow-y-auto">
                {notes.length === 0 ? (
                  <li className="text-sm text-muted">No customer notes yet.</li>
                ) : (
                  notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm"
                    >
                      <p className="whitespace-pre-wrap leading-snug text-foreground">{note.body}</p>
                      <p className="mt-1 text-[11px] text-muted">{formatDateTime(note.created_at)}</p>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>

          <div className="flex flex-col gap-4 xl:col-span-3">
            <Panel title="Chronological history" compact>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted">No history yet.</p>
              ) : (
                <ul className="cc-scroll max-h-[32rem] space-y-2.5 overflow-y-auto pr-1">
                  {timeline.map((event, index) => {
                    const label =
                      event.kind === "customer_tag"
                        ? `Tag: ${customerTagLabel(event.message)}`
                        : event.message;
                    return (
                      <li
                        key={`${event.kind}-${event.ref_id}-${index}`}
                        className="border-l-2 border-gold-dim/70 pl-2.5 text-sm"
                      >
                        <p className="leading-snug text-foreground">{label}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatDateTime(event.created_at)}
                          {event.context ? ` · ${event.context}` : ""}
                          {` · ${event.kind}`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
