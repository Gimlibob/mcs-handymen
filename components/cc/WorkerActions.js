"use client";

import { useState, useTransition } from "react";
import {
  createWorkerAction,
  setWorkerStatusAction,
} from "@/lib/cc/actions/workers";
import { workerStatusLabel } from "@/lib/cc/domain/worker-status";

export function CreateWorkerForm() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createWorkerAction(name);
      if (!result?.ok) {
        setError(
          result?.error === "invalid_input"
            ? "Enter a worker name."
            : "Could not create worker."
        );
        return;
      }
      window.location.assign("/command-center/workers");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="worker-display-name" className="mb-1.5 block text-xs font-medium text-muted">
          Display name
        </label>
        <input
          id="worker-display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mike Smith"
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create worker"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300 sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function WorkerStatusToggle({ workerId, status }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const next = status === "active" ? "inactive" : "active";

  function onToggle() {
    setError(null);
    startTransition(async () => {
      const result = await setWorkerStatusAction(workerId, next);
      if (!result?.ok) {
        setError("Could not update status.");
        return;
      }
      window.location.assign("/command-center/workers");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className="rounded-lg border border-border-soft px-3 py-1.5 text-xs font-medium text-muted hover:border-gold hover:text-gold-bright disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : status === "active"
            ? "Mark inactive"
            : "Mark active"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
      <span className="sr-only">{workerStatusLabel(status)}</span>
    </div>
  );
}
