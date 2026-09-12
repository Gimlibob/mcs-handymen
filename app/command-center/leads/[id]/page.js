import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { AddNoteForm, StatusChangeForm } from "@/components/cc/LeadActions";
import {
  getLeadActivity,
  getLeadById,
  getLeadNotes,
  getLeadPhotos,
} from "@/lib/cc/db/leads";
import {
  getAllowedNextStatuses,
  getNextAction,
  statusLabel,
} from "@/lib/cc/domain/lead-status";
import { getStatusBadgeTone } from "@/lib/cc/ui/status-tone";

export const dynamic = "force-dynamic";

const RECENT_NOTES_VISIBLE = 5;

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
  if (!value) return "Not specified";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not specified";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSource(source) {
  if (!source) return null;
  if (source === "website_quote") return "Website";
  return source;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const lead = await getLeadById(id);
    if (!lead) return { title: "Lead" };
    return { title: lead.full_name };
  } catch {
    return { title: "Lead" };
  }
}

function Panel({ title, children, className = "", accent = false, compact = false }) {
  return (
    <section
      className={`rounded-2xl border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${
        accent ? "border-gold-dim/45" : "border-border-soft"
      } ${compact ? "p-4" : "p-5"} ${className}`}
    >
      {title ? (
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
    </section>
  );
}

export default async function LeadDetailPage({ params }) {
  await requireOwner();
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadById(id);
  } catch {
    console.error("[cc/lead] load failed");
    throw new Error("Unable to load lead.");
  }

  if (!lead) notFound();

  const [photos, notes, activity] = await Promise.all([
    getLeadPhotos(lead.id),
    getLeadNotes(lead.id),
    getLeadActivity(lead.id),
  ]);

  const allowedNext = getAllowedNextStatuses(lead.status);
  const nextAction = getNextAction(lead.status);
  const sourceLabel = formatSource(lead.source);
  const recentNotes = notes.slice(0, RECENT_NOTES_VISIBLE);
  const olderNotesCount = Math.max(notes.length - recentNotes.length, 0);

  return (
    <CommandCenterShell pathname={`/command-center/leads/${lead.id}`}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <Link
            href="/command-center/leads"
            className="text-sm font-medium text-muted hover:text-gold-bright"
          >
            ← Leads
          </Link>

          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
                  {lead.full_name}
                </h1>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${getStatusBadgeTone(lead.status)}`}
                >
                  {statusLabel(lead.status)}
                </span>
              </div>
              <p className="mt-2 text-base text-muted">
                {lead.city} · {lead.project_type}
                {sourceLabel ? (
                  <>
                    <span className="mx-2 text-border-soft">·</span>
                    <span>{sourceLabel}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="min-w-[240px] rounded-2xl border border-gold-dim/50 bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] xl:max-w-sm xl:flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Next Action
              </p>
              {nextAction ? (
                <p className="mt-2 font-heading text-2xl font-semibold text-gold-bright xl:text-[1.75rem]">
                  {nextAction}
                </p>
              ) : (
                <p className="mt-2 text-base text-muted">No further action — lead is closed.</p>
              )}
            </div>
          </div>
        </div>

        {/*
          Desktop: left info | center work | right decision
          Center gets the widest column.
        */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
          {/* Left — compact reference */}
          <div className="flex flex-col gap-4 xl:col-span-3">
            <Panel title="Customer Information" compact>
              <dl className="grid gap-2.5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Name</dt>
                  <dd className="text-foreground">{lead.full_name}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${lead.email}`}
                      className="break-all font-medium text-gold-bright hover:underline"
                    >
                      {lead.email}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">City</dt>
                  <dd className="text-foreground">{lead.city}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Contact method</dt>
                  <dd className="text-foreground">{lead.contact_method}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Project Information" compact>
              <dl className="grid gap-2.5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Service</dt>
                  <dd className="text-foreground">{lead.project_type}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Property type</dt>
                  <dd className="text-foreground">{lead.property_type}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Preferred date</dt>
                  <dd className="text-foreground">{formatDate(lead.preferred_date)}</dd>
                </div>
                {sourceLabel ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted">Source</dt>
                    <dd className="text-foreground">{sourceLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </Panel>
          </div>

          {/* Right — decision (lg: beside left; xl: right rail). Next Action lives in header only. */}
          <div className="flex flex-col gap-4 lg:col-start-2 xl:col-span-3 xl:col-start-10">
            <Panel title="Status" compact>
              <div className="mb-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-medium ${getStatusBadgeTone(lead.status)}`}
                >
                  {statusLabel(lead.status)}
                </span>
              </div>
              <dl className="mb-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Created</dt>
                  <dd className="text-right text-foreground">{formatDateTime(lead.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Updated</dt>
                  <dd className="text-right text-foreground">{formatDateTime(lead.updated_at)}</dd>
                </div>
              </dl>
              <div className="border-t border-border-soft pt-4">
                <StatusChangeForm
                  leadId={lead.id}
                  currentStatus={lead.status}
                  allowedNext={allowedNext}
                />
              </div>
            </Panel>

            <Panel title="History" compact>
              {activity.length === 0 ? (
                <p className="text-sm text-muted">No history yet.</p>
              ) : (
                <ul className="cc-scroll max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {activity.map((event) => (
                    <li key={event.id} className="border-l-2 border-gold-dim/70 pl-2.5 text-sm">
                      <p className="leading-snug text-foreground">{event.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDateTime(event.created_at)} · {event.event_type}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/*
              Future slot (not implemented in Phase 3): Customer Profile / Customer Intelligence.
              Architecture keeps this right rail extensible for later objective facts
              (jobs completed, new vs repeat, first/last job, revenue, estimates accepted/refused,
              callbacks, recurrence, original source) computed from real data only — plus a
              separate subjective evaluation layer (communication, price sensitivity, payment,
              scope behavior, professionalism, overall rating A–D, internal notes) and derived
              labels (New/Repeat/VIP/At Risk/Do Not Prioritize). Subjective ratings must stay
              distinct from facts; AI must never unilaterally brand a customer as "bad".
              Requires future schema + APIs — do not invent data here.
            */}
          </div>

          {/* Center — work surface */}
          <div className="flex flex-col gap-5 lg:col-span-2 xl:col-span-6 xl:col-start-4 xl:row-start-1">
            <Panel title="Description / Scope">
              <p className="min-h-[6rem] whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {lead.description || "No description provided."}
              </p>
            </Panel>

            <Panel title="Photos">
              <p className="-mt-1 mb-3 text-xs text-muted">
                Owner-only stream — not a public gallery URL.
              </p>
              {photos.length === 0 ? (
                <p className="text-sm text-muted">No photos on this lead.</p>
              ) : (
                <ul
                  className={`grid gap-4 ${
                    photos.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"
                  }`}
                >
                  {photos.map((photo, index) => (
                    <li
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-border-soft bg-surface-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/cc/lead-photos/${photo.id}`}
                        alt={`Project photo ${index + 1}`}
                        className={`w-full object-cover ${
                          photos.length === 1 ? "max-h-[420px] object-contain bg-surface-2" : "aspect-[4/3]"
                        }`}
                      />
                      <p className="truncate px-3 py-2 text-xs text-muted">{photo.blob_pathname}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Notes">
              <AddNoteForm leadId={lead.id} />
              <ul className="cc-scroll mt-4 max-h-64 space-y-2 overflow-y-auto">
                {recentNotes.length === 0 ? (
                  <li className="text-sm text-muted">No notes yet.</li>
                ) : (
                  recentNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm"
                    >
                      <p className="whitespace-pre-wrap leading-snug text-foreground">{note.body}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatDateTime(note.created_at)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              {olderNotesCount > 0 ? (
                <p className="mt-3 text-xs text-muted">
                  Showing {recentNotes.length} most recent · {olderNotesCount} older note
                  {olderNotesCount === 1 ? "" : "s"} not listed here
                </p>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
