"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCustomerNoteAction,
  setCustomerTagsAction,
} from "@/lib/cc/actions/customers";
import { CUSTOMER_TAG_KEYS, customerTagLabel } from "@/lib/cc/domain/customer-tags";

export function AddCustomerNoteForm({ customerId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addCustomerNoteAction(customerId, body);
      if (!result?.ok) {
        setError(result?.error === "empty_note" ? "Write a note first." : "Could not save note.");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="customer-note-body" className="text-xs font-medium text-muted">
        Private customer note
      </label>
      <textarea
        id="customer-note-body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Permanent notes about this customer (not specific to one lead)…"
        className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
      />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || body.trim().length === 0}
        className="self-start rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-gold-bright hover:border-gold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save customer note"}
      </button>
    </form>
  );
}

export function CustomerTagsForm({ customerId, selectedKeys = [] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set(selectedKeys));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setCustomerTagsAction(customerId, [...selected]);
      if (!result?.ok) {
        setError("Could not update tags.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-muted">Owner-only operational tags. Manual — no AI.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CUSTOMER_TAG_KEYS.map((key) => {
          const checked = selected.has(key);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-foreground hover:border-gold/50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  className="accent-[var(--gold)]"
                />
                {customerTagLabel(key)}
              </label>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save tags"}
      </button>
    </form>
  );
}
