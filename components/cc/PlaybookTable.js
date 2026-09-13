import Link from "next/link";
import {
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_REVISION_STATUSES,
  PLAYBOOK_SENSITIVITIES,
  PLAYBOOK_VALIDATION_STATES,
  playbookAppliesToLabel,
  playbookCategoryLabel,
  playbookRevisionStatusLabel,
  playbookSensitivityLabel,
  playbookValidationStateLabel,
} from "@/lib/cc/domain/playbook";
import { SERVICES } from "@/lib/site-config";

function statusTone(status) {
  if (status === "approved") return "border-emerald-500/40 text-emerald-100";
  if (status === "retired") return "border-border-soft text-muted";
  return "border-amber-500/40 text-amber-100";
}

export function PlaybookStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-muted">No version yet</span>;
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(
        status
      )}`}
    >
      {playbookRevisionStatusLabel(status)}
    </span>
  );
}

export function PlaybookFilters({
  q = "",
  category = "",
  serviceKey = "",
  validationState = "",
  sensitivity = "",
  revisionStatus = "",
}) {
  return (
    <form
      method="get"
      action="/command-center/playbook"
      className="grid gap-3 rounded-2xl border border-border-soft bg-surface p-4 md:grid-cols-2 xl:grid-cols-6"
    >
      <div className="xl:col-span-2">
        <label htmlFor="pb-q" className="mb-1.5 block text-xs font-medium text-muted">
          Search
        </label>
        <input
          id="pb-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Rule name or summary…"
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        />
      </div>
      <div>
        <label htmlFor="pb-filter-category" className="mb-1.5 block text-xs font-medium text-muted">
          Type
        </label>
        <select
          id="pb-filter-category"
          name="category"
          defaultValue={category}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          <option value="">All types</option>
          {PLAYBOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {playbookCategoryLabel(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pb-filter-service" className="mb-1.5 block text-xs font-medium text-muted">
          Applies to
        </label>
        <select
          id="pb-filter-service"
          name="service"
          defaultValue={serviceKey}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          <option value="">All services</option>
          {SERVICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pb-filter-validation" className="mb-1.5 block text-xs font-medium text-muted">
          Status
        </label>
        <select
          id="pb-filter-validation"
          name="validation"
          defaultValue={validationState}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          <option value="">All</option>
          {PLAYBOOK_VALIDATION_STATES.map((s) => (
            <option key={s} value={s}>
              {playbookValidationStateLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pb-filter-sensitivity" className="mb-1.5 block text-xs font-medium text-muted">
          Who for
        </label>
        <select
          id="pb-filter-sensitivity"
          name="sensitivity"
          defaultValue={sensitivity}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          <option value="">All</option>
          {PLAYBOOK_SENSITIVITIES.map((s) => (
            <option key={s} value={s}>
              {playbookSensitivityLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="xl:col-span-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="pb-filter-rev" className="mb-1.5 block text-xs font-medium text-muted">
            Draft / Approved / Retired
          </label>
          <select
            id="pb-filter-rev"
            name="status"
            defaultValue={revisionStatus}
            className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">All versions</option>
            {PLAYBOOK_REVISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {playbookRevisionStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-gold-dim/55 px-4 py-2.5 text-sm font-medium text-gold-bright hover:border-gold"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}

export function PlaybookTable({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-border-soft bg-surface p-6 text-sm text-muted">
        No rules match these filters yet. Start with a draft — nothing is published to agents in
        this phase.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border-soft text-xs uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Rule name</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Applies to</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Version</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border-soft/70 last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/command-center/playbook/${entry.id}`}
                  className="font-medium text-gold-bright hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {playbookValidationStateLabel(entry.validation_state)}
                </p>
              </td>
              <td className="px-4 py-3 text-foreground">
                {playbookCategoryLabel(entry.category)}
              </td>
              <td className="px-4 py-3 text-foreground">
                {playbookAppliesToLabel(entry.service_keys)}
              </td>
              <td className="px-4 py-3">
                <PlaybookStatusBadge status={entry.latest_status} />
              </td>
              <td className="px-4 py-3 tabular-nums text-muted">
                {entry.latest_version != null ? `v${entry.latest_version}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
