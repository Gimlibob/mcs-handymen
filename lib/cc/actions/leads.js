"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { addLeadNote, updateLeadStatus } from "@/lib/cc/db/leads";

export async function changeLeadStatusAction(leadId, nextStatus) {
  await requireOwner();

  if (typeof leadId !== "string" || typeof nextStatus !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await updateLeadStatus({
    leadId,
    nextStatus,
    actor: "owner",
  });

  if (result.ok) {
    revalidatePath("/command-center");
    revalidatePath("/command-center/leads");
    revalidatePath(`/command-center/leads/${leadId}`);
  }

  return result;
}

export async function addLeadNoteAction(leadId, body) {
  await requireOwner();

  if (typeof leadId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await addLeadNote({
    leadId,
    body,
    actor: "owner",
  });

  if (result.ok) {
    revalidatePath(`/command-center/leads/${leadId}`);
    revalidatePath("/command-center");
  }

  return result;
}
