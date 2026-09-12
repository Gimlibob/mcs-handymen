"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeLeadStatusAction, addLeadNoteAction } from "@/lib/cc/actions/leads";
import { statusLabel } from "@/lib/cc/domain/lead-status";

export function StatusChangeForm({ leadId, currentStatus, allowedNext = [] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [next, setNext] = useState(allowedNext[0] || "");

  if (allowedNext.length === 0) {
    return (
      <p className="text-sm text-muted">
        No further manual transitions from <span className="text-foreground">{statusLabel(currentStatus)}</span>.
      </p>
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changeLeadStatusAction(leadId, next);
      if (!result?.ok) {
        setError(
          result?.error === "invalid_transition"
            ? "That status change is not allowed."
            : "Could not update status."
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="next-status" className="mb-1.5 block text-xs font-medium text-muted">
          Change status
        </label>
        <select
          id="next-status"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          {allowedNext.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !next}
        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300 sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}

export function AddNoteForm({ leadId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addLeadNoteAction(leadId, body);
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
      <label htmlFor="note-body" className="text-xs font-medium text-muted">
        Add internal note
      </label>
      <textarea
        id="note-body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Call notes, missing details, next step…"
        className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
      />
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || body.trim().length === 0}
        className="self-start rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-gold-bright hover:border-gold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}
