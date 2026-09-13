"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import {
  createPlaybookDraftRevision,
  createPlaybookEntryWithDraft,
  updatePlaybookDraftRevision,
  updatePlaybookEntryMetadata,
} from "@/lib/cc/db/playbook";
import { parsePlaybookListInput, parsePlaybookServiceKeysInput, normalizePlaybookSlug } from "@/lib/cc/domain/playbook";

function revalidatePlaybook(entryId) {
  revalidatePath("/command-center/playbook");
  if (entryId) {
    revalidatePath(`/command-center/playbook/${entryId}`);
  }
}

/**
 * Create Playbook entry + initial draft. No approve. No CRM writes.
 */
export async function createPlaybookEntryAction(formData) {
  await requireOwner();

  if (!formData || typeof formData.get !== "function") {
    return { ok: false, error: "invalid_input" };
  }

  const title = String(formData.get("title") || "");
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugRaw || normalizePlaybookSlug(title);
  const serviceRaw = formData.getAll
    ? formData.getAll("serviceKeys")
    : [String(formData.get("serviceKeys") || "")];

  const result = await createPlaybookEntryWithDraft({
    slug,
    category: String(formData.get("category") || ""),
    title,
    serviceKeys: parsePlaybookServiceKeysInput(serviceRaw),
    tags: parsePlaybookListInput(String(formData.get("tags") || "")),
    sensitivity: String(formData.get("sensitivity") || ""),
    validationState: String(formData.get("validationState") || ""),
    summary: String(formData.get("summary") || ""),
    bodyMd: String(formData.get("bodyMd") || ""),
    changeNote: String(formData.get("changeNote") || ""),
    createdBy: "owner",
  });

  if (result.ok) {
    revalidatePlaybook(result.entry.id);
  }

  return result;
}

export async function updatePlaybookEntryMetadataAction(entryId, formData) {
  await requireOwner();

  if (typeof entryId !== "string" || !formData || typeof formData.get !== "function") {
    return { ok: false, error: "invalid_input" };
  }

  const serviceRaw = formData.getAll
    ? formData.getAll("serviceKeys")
    : [String(formData.get("serviceKeys") || "")];

  const result = await updatePlaybookEntryMetadata({
    entryId,
    title: String(formData.get("title") || ""),
    category: String(formData.get("category") || ""),
    serviceKeys: parsePlaybookServiceKeysInput(serviceRaw),
    tags: parsePlaybookListInput(String(formData.get("tags") || "")),
    sensitivity: String(formData.get("sensitivity") || ""),
    validationState: String(formData.get("validationState") || ""),
  });

  if (result.ok) {
    revalidatePlaybook(entryId);
  }

  return result;
}

export async function updatePlaybookDraftRevisionAction(revisionId, formData) {
  await requireOwner();

  if (typeof revisionId !== "string" || !formData || typeof formData.get !== "function") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await updatePlaybookDraftRevision({
    revisionId,
    summary: String(formData.get("summary") || ""),
    bodyMd: String(formData.get("bodyMd") || ""),
    changeNote: String(formData.get("changeNote") || ""),
  });

  if (result.ok) {
    revalidatePlaybook(result.revision.entry_id);
  }

  return result;
}

export async function createAdditionalPlaybookDraftAction(entryId, formData) {
  await requireOwner();

  if (typeof entryId !== "string" || !formData || typeof formData.get !== "function") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await createPlaybookDraftRevision({
    entryId,
    summary: String(formData.get("summary") || ""),
    bodyMd: String(formData.get("bodyMd") || ""),
    changeNote: String(formData.get("changeNote") || ""),
    createdBy: "owner",
  });

  if (result.ok) {
    revalidatePlaybook(entryId);
  }

  return result;
}
