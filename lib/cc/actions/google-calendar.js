"use server";

import { requireOwner } from "@/lib/cc/auth/dal";
import { retryGoogleCalendarSync } from "@/lib/cc/google-calendar/sync-engine";
import { revalidatePath } from "next/cache";

/**
 * Owner-only Google Calendar sync retry (GC-1).
 * No UI yet — callable from future Job Detail control.
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
