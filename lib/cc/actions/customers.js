"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { addCustomerNote, setCustomerTags } from "@/lib/cc/db/customers";
import { isValidCustomerTag } from "@/lib/cc/domain/customer-tags";

export async function addCustomerNoteAction(customerId, body) {
  await requireOwner();

  if (typeof customerId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await addCustomerNote({
    customerId,
    body,
    actor: "owner",
  });

  if (result.ok) {
    revalidatePath(`/command-center/customers/${customerId}`);
    revalidatePath("/command-center/customers");
  }

  return result;
}

export async function setCustomerTagsAction(customerId, tagKeys) {
  await requireOwner();

  if (typeof customerId !== "string" || !Array.isArray(tagKeys)) {
    return { ok: false, error: "invalid_input" };
  }

  const cleaned = tagKeys.filter((k) => typeof k === "string" && isValidCustomerTag(k));
  const result = await setCustomerTags({
    customerId,
    tagKeys: cleaned,
    actor: "owner",
  });

  if (result.ok) {
    revalidatePath(`/command-center/customers/${customerId}`);
  }

  return result;
}
