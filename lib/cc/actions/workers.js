"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { createWorker, updateWorkerStatus } from "@/lib/cc/db/workers";

function revalidateWorkerPaths() {
  revalidatePath("/command-center/workers");
  revalidatePath("/command-center");
}

/**
 * Owner-only: create a Worker record (not an authentication account).
 */
export async function createWorkerAction(displayName) {
  await requireOwner();

  if (typeof displayName !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await createWorker({
    displayName,
    createdBy: "owner",
  });

  if (result.ok) {
    revalidateWorkerPaths();
  }

  return result;
}

/**
 * Owner-only: mark Worker active or inactive. Does not create auth.
 */
export async function setWorkerStatusAction(workerId, nextStatus) {
  await requireOwner();

  if (typeof workerId !== "string" || typeof nextStatus !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await updateWorkerStatus({ workerId, nextStatus });

  if (result.ok) {
    revalidateWorkerPaths();
    revalidatePath("/command-center/jobs", "layout");
  }

  return result;
}
