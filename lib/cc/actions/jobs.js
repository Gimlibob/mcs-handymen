"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/cc/auth/dal";
import {
  createJobFromLead,
  rescheduleJob,
  scheduleJob,
  setJobAssignedWorker,
  unscheduleJob,
  updateJobStatus,
} from "@/lib/cc/db/jobs";

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
  revalidatePath("/command-center/calendar");
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
 * Returns a slim serializable payload (not the full Neon Job row).
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

  if (!result.ok) {
    return result;
  }

  revalidateJobPaths({
    leadId: result.job.lead_id,
    jobId: result.job.id,
    customerId: result.job.customer_id,
  });

  return {
    ok: true,
    jobId: result.job.id,
    status: result.job.status,
  };
}

/**
 * Owner-only primary worker assignment. Does not change Job or Lead status.
 * Pass workerId null to unassign.
 * Returns a slim serializable payload.
 */
export async function setJobAssignedWorkerAction(jobId, workerId) {
  await requireOwner();

  if (typeof jobId !== "string") {
    return { ok: false, error: "invalid_input" };
  }
  if (
    workerId !== null &&
    workerId !== undefined &&
    typeof workerId !== "string"
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const result = await setJobAssignedWorker({
    jobId,
    workerId: workerId ?? null,
    actor: "owner",
  });

  if (!result.ok) {
    return result;
  }

  revalidateJobPaths({
    leadId: result.job.lead_id,
    jobId: result.job.id,
    customerId: result.job.customer_id,
  });

  return {
    ok: true,
    jobId: result.job.id,
    assignedWorkerId: result.job.assigned_worker_id ?? null,
    status: result.job.status,
  };
}

export async function scheduleJobAction(jobId, scheduledDate, scheduledWindow) {
  await requireOwner();

  if (typeof jobId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await scheduleJob({
    jobId,
    scheduledDate,
    scheduledWindow,
    actor: "owner",
  });

  if (!result.ok) return result;

  revalidateJobPaths({
    leadId: result.job.lead_id,
    jobId: result.job.id,
    customerId: result.job.customer_id,
  });

  return {
    ok: true,
    jobId: result.job.id,
    status: result.job.status,
    scheduledDate: result.job.scheduled_date,
    scheduledWindow: result.job.scheduled_window,
  };
}

export async function rescheduleJobAction(jobId, scheduledDate, scheduledWindow) {
  await requireOwner();

  if (typeof jobId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await rescheduleJob({
    jobId,
    scheduledDate,
    scheduledWindow,
    actor: "owner",
  });

  if (!result.ok) return result;

  revalidateJobPaths({
    leadId: result.job.lead_id,
    jobId: result.job.id,
    customerId: result.job.customer_id,
  });

  return {
    ok: true,
    jobId: result.job.id,
    status: result.job.status,
    scheduledDate: result.job.scheduled_date,
    scheduledWindow: result.job.scheduled_window,
  };
}

export async function unscheduleJobAction(jobId) {
  await requireOwner();

  if (typeof jobId !== "string") {
    return { ok: false, error: "invalid_input" };
  }

  const result = await unscheduleJob({
    jobId,
    actor: "owner",
  });

  if (!result.ok) return result;

  revalidateJobPaths({
    leadId: result.job.lead_id,
    jobId: result.job.id,
    customerId: result.job.customer_id,
  });

  return {
    ok: true,
    jobId: result.job.id,
    status: result.job.status,
    scheduledDate: result.job.scheduled_date,
    scheduledWindow: result.job.scheduled_window,
  };
}
