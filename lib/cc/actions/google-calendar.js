"use server";

import { requireOwner } from "@/lib/cc/auth/dal";
import { retryGoogleCalendarSync } from "@/lib/cc/google-calendar/sync-engine";
import {
  countFutureScheduledJobsForInitialSync,
  disconnectGoogleCalendar,
  repairGoogleCalendar,
  syncFutureScheduledJobs,
} from "@/lib/cc/google-calendar/connection-service";
import {
  decryptRefreshToken,
} from "@/lib/cc/google-calendar/token-crypto";
import { revokeGoogleRefreshToken } from "@/lib/cc/google-calendar/oauth-client";
import { isGoogleCalendarSyncEnabled } from "@/lib/cc/google-calendar/config";
import { revalidatePath } from "next/cache";

/**
 * Owner-only Google Calendar sync retry (GC-1 / GC-2).
 */
export async function retryGoogleCalendarSyncAction(jobId) {
  await requireOwner();

  if (typeof jobId !== "string" || !jobId.trim()) {
    return { ok: false, error: "invalid_input" };
  }

  const result = await retryGoogleCalendarSync(jobId.trim());

  if (result.ok) {
    revalidatePath(`/command-center/jobs/${jobId.trim()}`);
  }

  return {
    ok: result.ok,
    skipped: result.skipped || null,
    error: result.error || null,
    eventId: result.eventId || null,
  };
}

/**
 * Disconnect Google Calendar — requires explicit confirmation field.
 */
export async function disconnectGoogleCalendarAction(_prev, formData) {
  await requireOwner();

  const confirmed = formData?.get?.("confirm") === "disconnect";
  if (!confirmed) {
    return { ok: false, error: "Confirmation required." };
  }

  async function revokeFn(ciphertext) {
    try {
      const plain = decryptRefreshToken(ciphertext);
      await revokeGoogleRefreshToken(plain);
    } catch {
      // best-effort
    }
  }

  const result = await disconnectGoogleCalendar({ revokeFn });
  revalidatePath("/command-center/account");
  return {
    ok: Boolean(result?.ok),
    error: result?.ok ? null : "Unable to disconnect.",
    message: result?.ok ? "Google Calendar disconnected." : null,
  };
}

/**
 * Repair missing MCS Jobs calendar (explicit).
 */
export async function repairGoogleCalendarAction(_prev, formData) {
  await requireOwner();

  if (!isGoogleCalendarSyncEnabled()) {
    return { ok: false, error: "Google Calendar sync is disabled." };
  }

  const confirmed = formData?.get?.("confirm") === "repair";
  if (!confirmed) {
    return { ok: false, error: "Confirmation required." };
  }

  const result = await repairGoogleCalendar();
  revalidatePath("/command-center/account");
  if (!result.ok) {
    return {
      ok: false,
      error:
        typeof result.error === "string"
          ? result.error
          : "Unable to repair calendar.",
    };
  }
  return {
    ok: true,
    message: "MCS Jobs calendar repaired. Sync future scheduled Jobs when ready.",
  };
}

/**
 * Explicit bulk initial sync of future scheduled Jobs.
 */
export async function syncFutureScheduledJobsAction(_prev, formData) {
  await requireOwner();

  if (!isGoogleCalendarSyncEnabled()) {
    return { ok: false, error: "Google Calendar sync is disabled." };
  }

  const confirmed = formData?.get?.("confirm") === "sync";
  if (!confirmed) {
    return { ok: false, error: "Confirmation required." };
  }

  const expected = Number(formData?.get?.("expectedCount") || 0);
  const count = await countFutureScheduledJobsForInitialSync();
  if (expected > 0 && expected !== count) {
    return {
      ok: false,
      error: `Job count changed (${count}). Refresh and try again.`,
    };
  }

  const result = await syncFutureScheduledJobs();
  revalidatePath("/command-center/account");
  revalidatePath("/command-center/jobs");

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "not_connected"
          ? "Google Calendar is not connected."
          : "Unable to sync Jobs.",
    };
  }

  return {
    ok: true,
    message: `Synced ${result.synced}, already synced ${result.alreadySynced}, failed ${result.failed} (of ${result.total}).`,
    synced: result.synced,
    alreadySynced: result.alreadySynced,
    failed: result.failed,
    total: result.total,
  };
}
