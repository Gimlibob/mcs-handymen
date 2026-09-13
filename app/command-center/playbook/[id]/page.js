import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import {
  PlaybookApproveButton,
  PlaybookDraftEditForm,
  PlaybookEntryMetadataForm,
  PlaybookNewDraftForm,
  PlaybookRetireButton,
} from "@/components/cc/PlaybookForms";
import { PlaybookStatusBadge } from "@/components/cc/PlaybookTable";
import {
  getPlaybookEntryById,
  listPlaybookRevisionsForEntry,
} from "@/lib/cc/db/playbook";
import {
  playbookAppliesToLabel,
  playbookCategoryLabel,
  playbookSensitivityLabel,
  playbookValidationStateLabel,
} from "@/lib/cc/domain/playbook";
import { SERVICES } from "@/lib/site-config";

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

function serviceNames(serviceKeys) {
  const keys = Array.isArray(serviceKeys) ? serviceKeys : [];
  if (keys.length === 0 || keys.includes("*")) return "All services";
  return keys
    .map((id) => SERVICES.find((s) => s.id === id)?.name || id)
    .join(", ");
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      {title ? (
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const entry = await getPlaybookEntryById(id);
    if (!entry) return { title: "Playbook rule" };
    return { title: entry.title };
  } catch {
    return { title: "Playbook rule" };
  }
}

export default async function PlaybookDetailPage({ params }) {
  await requireOwner();
  const { id } = await params;

  let entry;
  try {
    entry = await getPlaybookEntryById(id);
  } catch {
    console.error("[cc/playbook] detail load failed");
    throw new Error("Unable to load Playbook rule.");
  }

  if (!entry) notFound();

  const revisions = await listPlaybookRevisionsForEntry(entry.id);
  const editableDrafts = revisions.filter((r) => r.status === "draft");

  return (
    <CommandCenterShell pathname={`/command-center/playbook/${entry.id}`}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/command-center/playbook"
            className="text-sm font-medium text-muted hover:text-gold-bright"
          >
            ← Playbook
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
              {entry.title}
            </h1>
            <PlaybookStatusBadge status={revisions[0]?.status} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {playbookCategoryLabel(entry.category)}
            <span className="mx-2 text-border-soft">·</span>
            {playbookValidationStateLabel(entry.validation_state)}
            <span className="mx-2 text-border-soft">·</span>
            Applies to {serviceNames(entry.service_keys)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Only entries marked Validated MCS rule can be approved. Approved knowledge can be used by
            MCS AI agents. Hypothesis and discussion stay owner-only drafts.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex flex-col gap-5 xl:col-span-4">
            <Panel title="Rule details">
              <dl className="grid gap-2.5 text-sm">
                <div>
                  <dt className="text-xs text-muted">Type</dt>
                  <dd className="text-foreground">{playbookCategoryLabel(entry.category)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className="text-foreground">
                    {playbookValidationStateLabel(entry.validation_state)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Who is this for?</dt>
                  <dd className="text-foreground">{playbookSensitivityLabel(entry.sensitivity)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Applies to</dt>
                  <dd className="text-foreground">{serviceNames(entry.service_keys)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Labels</dt>
                  <dd className="text-foreground">
                    {(entry.tags || []).length ? entry.tags.join(", ") : "—"}
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Edit rule details">
              <PlaybookEntryMetadataForm entry={entry} />
            </Panel>

            <Panel title="Add draft version">
              <PlaybookNewDraftForm entryId={entry.id} />
            </Panel>

            <details className="rounded-2xl border border-border-soft bg-surface p-5 text-sm">
              <summary className="cursor-pointer font-medium text-muted hover:text-foreground">
                Technical details (audit)
              </summary>
              <dl className="mt-4 grid gap-2 text-xs text-muted">
                <div>
                  <dt>Entry ID</dt>
                  <dd className="break-all text-foreground/80">{entry.id}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd className="text-foreground/80">{entry.slug}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd className="text-foreground/80">
                    {formatDateTime(entry.created_at)}
                    {entry.created_by ? ` · ${entry.created_by}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd className="text-foreground/80">{formatDateTime(entry.updated_at)}</dd>
                </div>
                <div>
                  <dt>service_keys</dt>
                  <dd className="text-foreground/80">
                    {playbookAppliesToLabel(entry.service_keys)}
                  </dd>
                </div>
              </dl>
            </details>
          </div>

          <div className="flex flex-col gap-5 xl:col-span-8">
            <Panel title="Versions">
              {revisions.length === 0 ? (
                <p className="text-sm text-muted">No versions yet.</p>
              ) : (
                <ul className="space-y-4">
                  {revisions.map((rev) => (
                    <li
                      key={rev.id}
                      className="rounded-xl border border-border-soft bg-surface-2 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">Version {rev.version}</p>
                        <PlaybookStatusBadge status={rev.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Created {formatDateTime(rev.created_at)}
                        {rev.created_by ? ` · ${rev.created_by}` : ""}
                        {rev.approved_at
                          ? ` · Approved ${formatDateTime(rev.approved_at)}${
                              rev.approved_by ? ` · ${rev.approved_by}` : ""
                            }`
                          : ""}
                        {rev.retired_at ? ` · Retired ${formatDateTime(rev.retired_at)}` : ""}
                      </p>
                      {rev.summary ? (
                        <p className="mt-2 text-sm text-foreground">{rev.summary}</p>
                      ) : null}
                      {rev.change_note ? (
                        <p className="mt-1 text-xs text-muted">Internal note: {rev.change_note}</p>
                      ) : null}
                      <pre className="cc-scroll mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border-soft bg-surface px-3 py-2 text-xs text-foreground">
                        {rev.body_md || "(empty)"}
                      </pre>
                      <details className="mt-2 text-[11px] text-muted">
                        <summary className="cursor-pointer hover:text-foreground">
                          Technical version id
                        </summary>
                        <p className="mt-1 break-all">{rev.id}</p>
                      </details>
                      {rev.status === "draft" && entry.validation_state === "validated" ? (
                        <PlaybookApproveButton
                          entryId={entry.id}
                          revisionId={rev.id}
                          version={rev.version}
                        />
                      ) : null}
                      {rev.status === "draft" && entry.validation_state !== "validated" ? (
                        <p className="mt-2 text-xs text-muted">
                          Set Status to Validated MCS rule before this draft can be approved for
                          agents.
                        </p>
                      ) : null}
                      {rev.status === "approved" ? (
                        <PlaybookRetireButton
                          entryId={entry.id}
                          revisionId={rev.id}
                          version={rev.version}
                        />
                      ) : null}
                      {rev.status !== "draft" ? (
                        <p className="mt-2 text-xs text-muted">
                          Locked — approved/retired versions cannot be edited here.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {editableDrafts.length > 0 ? (
              <Panel title="Edit draft">
                <div className="space-y-8">
                  {editableDrafts.map((rev) => (
                    <div key={rev.id}>
                      <p className="mb-3 text-sm font-medium text-foreground">
                        Editing draft v{rev.version}
                      </p>
                      <PlaybookDraftEditForm revision={rev} />
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
