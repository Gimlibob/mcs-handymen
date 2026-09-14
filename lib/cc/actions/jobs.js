"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import { createJobFromLead, updateJobStatus } from "@/lib/cc/db/jobs";

function revalidateJobPaths({ leadId, jobId, customerId } = {}) {
  if (leadId) {
    revalidatePath(`/command-center/leads/${leadId}`);
  }
  if (jobId) {
    revalidatePath(`/command-center/jobs/${jobId}`);
  }
  if (customerId) {
    revalidatePath(`/command-center/customers/${customerId}`);
  }
  revalidatePath("/command-center");
  revalidatePath("/command-center/leads");
}

/**
 * Explicit owner action: convert eligible Lead into a Job.
 * Idempotent when an active Job already exists.
 */
export async function createJobFromLeadAction(leadId) {
  await requireOwner();

  if (typeof leadId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await createJobFromLead({
    leadId,
    createdBy: "owner",
  });

  if (result.ok) {
    revalidateJobPaths({
      leadId,
      jobId: result.job.id,
      customerId: result.job.customer_id,
    });
  }

  return result;
}

/**
 * Explicit owner Job status change. Does not modify Lead status.
 */
export async function changeJobStatusAction(jobId, nextStatus) {
  await requireOwner();

  if (typeof jobId !== "string" || typeof nextStatus !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await updateJobStatus({
    jobId,
    nextStatus,
    actor: "owner",
  });

  if (result.ok) {
    revalidateJobPaths({
      leadId: result.job.lead_id,
      jobId: result.job.id,
      customerId: result.job.customer_id,
    });
  }

  return result;
}
