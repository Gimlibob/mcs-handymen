"use client";

import { useActionState, useState } from "react";
import {
  disconnectGoogleCalendarAction,
  repairGoogleCalendarAction,
  syncFutureScheduledJobsAction,
} from "@/lib/cc/actions/google-calendar";

const idle = { ok: false, error: null, message: null };

/**
 * Compact Google Calendar connection controls for Account page.
 */
export default function GoogleCalendarAccountPanel({
  status,
  email,
  calendarLabel,
  lastError,
  futureCount,
  syncEnabled,
  flash,
}) {
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectGoogleCalendarAction,
    idle
  );
  const [repairState, repairAction, repairPending] = useActionState(
    repairGoogleCalendarAction,
    idle
  );
  const [syncState, syncAction, syncPending] = useActionState(
    syncFutureScheduledJobsAction,
    idle
  );
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);

  const flashMessage = flashMessageFor(flash);
  const statusLabel = statusLabelFor(status);
  const showConnect =
    !status ||
    status === "disconnected" ||
    status === "revoked" ||
    (status === "error" && !lastError?.includes("calendar not found"));
  const showRepair =
    status === "error" &&
    (lastError === "MCS Jobs calendar not found" ||
      flash === "calendar_missing");
  const showDisconnect = status === "connected";
  const showInitialSync = status === "connected" && syncEnabled;

  return (
    <div className="flex flex-col gap-4">
      {flashMessage ? (
        <p
          role="status"
          className="rounded-lg border border-gold-dim/40 bg-surface-2 px-3 py-2 text-sm text-gold-bright"
        >
          {flashMessage}
        </p>
      ) : null}

      {(disconnectState?.error ||
        repairState?.error ||
        syncState?.error) && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200"
        >
          {disconnectState?.error || repairState?.error || syncState?.error}
        </p>
      )}

      {(disconnectState?.message ||
        repairState?.message ||
        syncState?.message) && (
        <p
          role="status"
          className="rounded-lg border border-gold-dim/40 bg-surface-2 px-3 py-2 text-sm text-gold-bright"
        >
          {disconnectState?.message ||
            repairState?.message ||
            syncState?.message}
        </p>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Status</dt>
          <dd className="text-right text-foreground">{statusLabel}</dd>
        </div>
        {email ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Account</dt>
            <dd className="text-right text-foreground">{email}</dd>
          </div>
        ) : null}
        {status === "connected" && calendarLabel ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Calendar</dt>
            <dd className="text-right text-foreground">{calendarLabel}</dd>
          </div>
        ) : null}
        {status === "error" && lastError ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Error</dt>
            <dd className="text-right text-red-200">{lastError}</dd>
          </div>
        ) : null}
      </dl>

      {showInitialSync ? (
        <p className="text-sm text-muted">
          {futureCount} future scheduled Jobs ready to sync
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {showConnect && syncEnabled ? (
          <a
            href="/api/google-calendar/oauth/start"
            className="inline-flex items-center justify-center rounded-lg border border-gold-dim/50 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-bright hover:bg-gold/20"
          >
            {status === "disconnected" || status === "revoked"
              ? status === "revoked"
                ? "Reconnect"
                : "Connect again"
              : "Connect Google Calendar"}
          </a>
        ) : null}

        {!syncEnabled ? (
          <p className="text-sm text-muted">
            Google Calendar sync is not enabled in this environment.
          </p>
        ) : null}

        {showDisconnect ? (
          confirmDisconnect ? (
            <form action={disconnectAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="confirm" value="disconnect" />
              <button
                type="submit"
                disabled={disconnectPending}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950/30 disabled:opacity-60"
              >
                {disconnectPending ? "Disconnecting…" : "Confirm disconnect"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="rounded-lg border border-border-soft px-4 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-foreground hover:border-gold-dim/50"
            >
              Disconnect
            </button>
          )
        ) : null}

        {showRepair && syncEnabled ? (
          confirmRepair ? (
            <form action={repairAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="confirm" value="repair" />
              <button
                type="submit"
                disabled={repairPending}
                className="rounded-lg border border-gold-dim/50 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-bright disabled:opacity-60"
              >
                {repairPending ? "Repairing…" : "Confirm repair"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRepair(false)}
                className="rounded-lg border border-border-soft px-4 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRepair(true)}
              className="rounded-lg border border-gold-dim/50 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-bright"
            >
              Repair Google Calendar
            </button>
          )
        ) : null}

        {showInitialSync && futureCount > 0 ? (
          confirmSync ? (
            <form action={syncAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="confirm" value="sync" />
              <input type="hidden" name="expectedCount" value={String(futureCount)} />
              <button
                type="submit"
                disabled={syncPending}
                className="rounded-lg border border-gold-dim/50 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-bright disabled:opacity-60"
              >
                {syncPending
                  ? "Syncing…"
                  : `Confirm sync ${futureCount} Jobs`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSync(false)}
                className="rounded-lg border border-border-soft px-4 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSync(true)}
              className="rounded-lg border border-gold-dim/50 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-bright"
            >
              Sync {futureCount} Jobs
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

function statusLabelFor(status) {
  if (status === "connected") return "Connected";
  if (status === "disconnected") return "Disconnected";
  if (status === "revoked") return "Authorization expired";
  if (status === "error") return "Error";
  return "Not connected";
}

function flashMessageFor(flash) {
  if (!flash) return null;
  const map = {
    connected: "Google Calendar connected.",
    denied: "Google authorization was cancelled.",
    wrong_account:
      "Wrong Google account. Connect with the allowed business account.",
    missing_refresh_token:
      "Google did not return a refresh token. Try Connect again.",
    calendar_missing:
      "MCS Jobs calendar not found. Use Repair Google Calendar.",
    disabled: "Google Calendar sync is disabled here.",
    not_configured: "Google Calendar is not configured for this environment.",
    oauth_error: "Google authorization failed.",
    missing_code: "Google authorization was incomplete.",
    setup_error: "Google Calendar setup could not finish.",
  };
  return map[flash] || null;
}
