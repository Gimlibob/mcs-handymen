"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createAdditionalPlaybookDraftAction,
  createPlaybookEntryAction,
  updatePlaybookDraftRevisionAction,
  updatePlaybookEntryMetadataAction,
} from "@/lib/cc/actions/playbook";
import {
  PLAYBOOK_ALL_SERVICES_KEY,
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_SENSITIVITIES,
  PLAYBOOK_VALIDATION_STATES,
  normalizePlaybookSlug,
  playbookCategoryLabel,
  playbookSensitivityHint,
  playbookSensitivityLabel,
  playbookValidationStateLabel,
} from "@/lib/cc/domain/playbook";
import { SERVICES } from "@/lib/site-config";

const fieldClass =
  "w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function SelectField({ id, name, label, hint, defaultValue, options }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={fieldClass} required>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function ServiceAppliesToField({ selectedKeys = [] }) {
  const initialAll =
    selectedKeys.includes(PLAYBOOK_ALL_SERVICES_KEY) || selectedKeys.length === 0;
  const [allServices, setAllServices] = useState(initialAll);
  const selected = useMemo(() => new Set(selectedKeys.filter((k) => k !== PLAYBOOK_ALL_SERVICES_KEY)), [
    selectedKeys,
  ]);

  return (
    <fieldset className="md:col-span-2">
      <legend className={labelClass}>Applies to</legend>
      <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name={allServices ? "serviceKeys" : undefined}
          value="all"
          checked={allServices}
          onChange={(e) => setAllServices(e.target.checked)}
        />
        All MCS services
      </label>
      {!allServices ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <label key={service.id} className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="serviceKeys"
                value={service.id}
                defaultChecked={selected.has(service.id)}
                className="mt-0.5"
              />
              <span>{service.name}</span>
            </label>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        Choose the MCS services this rule applies to, or keep “All MCS services”.
      </p>
    </fieldset>
  );
}

export function PlaybookCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const autoSlug = normalizePlaybookSlug(title);

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (!String(formData.get("slug") || "").trim()) {
      formData.set("slug", autoSlug);
    }
    startTransition(async () => {
      const result = await createPlaybookEntryAction(formData);
      if (!result?.ok) {
        const map = {
          invalid_slug: "Could not build a usable rule id from the name.",
          slug_taken: "A rule with that name already exists. Change the name slightly.",
          invalid_category: "Choose a valid type.",
          invalid_title: "Rule name is required.",
          invalid_sensitivity: "Choose who this is for.",
          invalid_validation_state: "Choose a status.",
        };
        setError(map[result?.error] || "Could not save this draft rule.");
        return;
      }
      router.push(`/command-center/playbook/${result.entry.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="pb-title" className={labelClass}>
            Rule name
          </label>
          <input
            id="pb-title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. What we need before quoting TV mounting"
            className={fieldClass}
          />
        </div>

        <input type="hidden" name="slug" value={autoSlug} />

        <SelectField
          id="pb-category"
          name="category"
          label="Type"
          defaultValue="lead_qualification"
          options={PLAYBOOK_CATEGORIES.map((c) => ({
            value: c,
            label: playbookCategoryLabel(c),
          }))}
        />
        <SelectField
          id="pb-validation"
          name="validationState"
          label="Status"
          defaultValue="discussion"
          options={PLAYBOOK_VALIDATION_STATES.map((s) => ({
            value: s,
            label: playbookValidationStateLabel(s),
          }))}
          hint="Only “Validated MCS rule” should later feed agents — after Approve exists."
        />
        <div className="md:col-span-2">
          <SelectField
            id="pb-sensitivity"
            name="sensitivity"
            label="Who is this for?"
            defaultValue="operational"
            options={PLAYBOOK_SENSITIVITIES.map((s) => ({
              value: s,
              label: playbookSensitivityLabel(s),
            }))}
            hint={playbookSensitivityHint("operational")}
          />
          <ul className="mt-2 space-y-1 text-[11px] text-muted">
            {PLAYBOOK_SENSITIVITIES.map((s) => (
              <li key={s}>
                <span className="text-foreground/80">{playbookSensitivityLabel(s)}:</span>{" "}
                {playbookSensitivityHint(s)}
              </li>
            ))}
          </ul>
        </div>

        <ServiceAppliesToField />

        <div className="md:col-span-2">
          <label htmlFor="pb-summary" className={labelClass}>
            Short summary
          </label>
          <input
            id="pb-summary"
            name="summary"
            placeholder="One-line reminder of the rule"
            className={fieldClass}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pb-body" className={labelClass}>
            MCS rule / procedure
          </label>
          <textarea
            id="pb-body"
            name="bodyMd"
            rows={10}
            placeholder="Write the rule or procedure in plain language…"
            className={fieldClass}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pb-note" className={labelClass}>
            Internal note (optional)
          </label>
          <input
            id="pb-note"
            name="changeNote"
            placeholder="Why you are adding this draft…"
            className={fieldClass}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pb-tags" className={labelClass}>
            Labels (optional)
          </label>
          <input
            id="pb-tags"
            name="tags"
            placeholder="e.g. quoting, safety"
            className={fieldClass}
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        Saves as a <span className="text-foreground">Draft</span> only. Approve and agent use come
        later.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save draft rule"}
      </button>
    </form>
  );
}

export function PlaybookEntryMetadataForm({ entry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [sensitivity, setSensitivity] = useState(entry.sensitivity);

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePlaybookEntryMetadataAction(entry.id, formData);
      if (!result?.ok) {
        setError("Could not update this rule.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="meta-title" className={labelClass}>
            Rule name
          </label>
          <input
            id="meta-title"
            name="title"
            required
            defaultValue={entry.title}
            className={fieldClass}
          />
        </div>
        <SelectField
          id="meta-category"
          name="category"
          label="Type"
          defaultValue={entry.category}
          options={PLAYBOOK_CATEGORIES.map((c) => ({
            value: c,
            label: playbookCategoryLabel(c),
          }))}
        />
        <SelectField
          id="meta-validation"
          name="validationState"
          label="Status"
          defaultValue={entry.validation_state}
          options={PLAYBOOK_VALIDATION_STATES.map((s) => ({
            value: s,
            label: playbookValidationStateLabel(s),
          }))}
        />
        <div className="md:col-span-2">
          <label htmlFor="meta-sensitivity" className={labelClass}>
            Who is this for?
          </label>
          <select
            id="meta-sensitivity"
            name="sensitivity"
            required
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
            className={fieldClass}
          >
            {PLAYBOOK_SENSITIVITIES.map((s) => (
              <option key={s} value={s}>
                {playbookSensitivityLabel(s)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">{playbookSensitivityHint(sensitivity)}</p>
        </div>
        <ServiceAppliesToField selectedKeys={entry.service_keys || []} />
        <div className="md:col-span-2">
          <label htmlFor="meta-tags" className={labelClass}>
            Labels (optional)
          </label>
          <input
            id="meta-tags"
            name="tags"
            defaultValue={(entry.tags || []).join(", ")}
            className={fieldClass}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-gold-bright hover:border-gold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save rule details"}
      </button>
    </form>
  );
}

export function PlaybookDraftEditForm({ revision }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  if (revision.status !== "draft") {
    return (
      <p className="text-sm text-muted">
        This version is locked ({revision.status}). Only drafts can be edited in this phase.
      </p>
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePlaybookDraftRevisionAction(revision.id, formData);
      if (!result?.ok) {
        setError(
          result?.error === "not_draft"
            ? "Only draft versions can be edited."
            : "Could not save draft."
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`draft-summary-${revision.id}`} className={labelClass}>
          Short summary
        </label>
        <input
          id={`draft-summary-${revision.id}`}
          name="summary"
          defaultValue={revision.summary || ""}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={`draft-body-${revision.id}`} className={labelClass}>
          MCS rule / procedure
        </label>
        <textarea
          id={`draft-body-${revision.id}`}
          name="bodyMd"
          rows={12}
          defaultValue={revision.body_md || ""}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={`draft-note-${revision.id}`} className={labelClass}>
          Internal note (optional)
        </label>
        <input
          id={`draft-note-${revision.id}`}
          name="changeNote"
          defaultValue={revision.change_note || ""}
          className={fieldClass}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}

export function PlaybookNewDraftForm({ entryId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createAdditionalPlaybookDraftAction(entryId, formData);
      if (!result?.ok) {
        setError("Could not create a new draft version.");
        return;
      }
      e.target.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Adds another Draft version of this rule. Does not approve or publish it.
      </p>
      <div>
        <label htmlFor="new-draft-summary" className={labelClass}>
          Short summary
        </label>
        <input id="new-draft-summary" name="summary" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="new-draft-body" className={labelClass}>
          MCS rule / procedure
        </label>
        <textarea id="new-draft-body" name="bodyMd" rows={6} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="new-draft-note" className={labelClass}>
          Internal note (optional)
        </label>
        <input id="new-draft-note" name="changeNote" className={fieldClass} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-gold-bright hover:border-gold disabled:opacity-60"
      >
        {pending ? "Creating…" : "Add draft version"}
      </button>
    </form>
  );
}
