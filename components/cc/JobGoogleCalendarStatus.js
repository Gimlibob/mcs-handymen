"use client";

import { useTransition } from "react";
import { retryGoogleCalendarSyncAction } from "@/lib/cc/actions/google-calendar";

/**
 * Minimal Job Detail Google Calendar sync status.
 */
export default function JobGoogleCalendarStatus({
  jobId,
  connected,
  syncStatus,
  syncError,
}) {
  const [pending, startTransition] = useTransition();

  const label = displayLabel({ connected, syncStatus });
  const canRetry =
    connected &&
    (syncStatus === "error" ||
      syncStatus === "pending" ||
      syncStatus === "missing_remote");

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Status</dt>
          <dd className="text-right text-foreground">{label}</dd>
        </div>
        {syncStatus === "error" && syncError ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Detail</dt>
            <dd className="text-right text-red-200">{syncError}</dd>
          </div>
        ) : null}
        {syncStatus === "missing_remote" ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Detail</dt>
            <dd className="text-right text-amber-100">Missing event</dd>
          </div>
        ) : null}
      </dl>

      {canRetry ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await retryGoogleCalendarSyncAction(jobId);
            });
          }}
          className="self-start rounded-lg border border-gold-dim/50 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold-bright disabled:opacity-60"
        >
          {pending ? "Retrying…" : "Retry sync"}
        </button>
      ) : null}
    </div>
  );
}

function displayLabel({ connected, syncStatus }) {
  if (!connected) return "Google Calendar not connected";
  if (!syncStatus || syncStatus === "none") return "Not synced";
  if (syncStatus === "pending") return "Pending";
  if (syncStatus === "synced") return "Synced";
  if (syncStatus === "error") return "Error";
  if (syncStatus === "missing_remote") return "Missing event";
  return "Not synced";
}
