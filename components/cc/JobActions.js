"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changeJobStatusAction,
  createJobFromLeadAction,
  rescheduleJobAction,
  scheduleJobAction,
  setJobAssignedWorkerAction,
  unscheduleJobAction,
} from "@/lib/cc/actions/jobs";
import { jobStatusLabel } from "@/lib/cc/domain/job-status";
import {
  SCHEDULE_WINDOWS,
  scheduleWindowLabel,
} from "@/lib/cc/domain/job-scheduling";
import { formatCalendarDate } from "@/lib/cc/domain/chicago-date";

/**
 * Lead Detail — create Job or open existing active Job.
 */
export function CreateJobFromLeadButton({ leadId, existingJobId = null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  if (existingJobId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          An active Job already exists for this lead.
        </p>
        <Link
          href={`/command-center/jobs/${existingJobId}`}
          className="inline-flex w-fit rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright"
        >
          Open Job
        </Link>
      </div>
    );
  }

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createJobFromLeadAction(leadId);
      if (!result?.ok) {
        const map = {
          lead_not_eligible: "This lead status cannot create a Job yet.",
          missing_customer: "Link a customer before creating a Job.",
          invalid_customer: "Customer is missing or merged — fix the customer link first.",
          incomplete_snapshots: "Lead is missing required project details.",
          lead_not_found: "Lead not found.",
          create_failed: "Could not create Job. Try again.",
        };
        setError(map[result?.error] || "Could not create Job.");
        return;
      }
      router.push(`/command-center/jobs/${result.job.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Creates authorized work from this lead. Snapshots scope at creation — later lead edits do
        not change the Job.
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={pending}
        className="inline-flex w-fit rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Creating…" : "Convert to Job"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Job Detail — minimal status change control.
 * After a successful write, use full navigation (not router.refresh) so the
 * page remounts reliably — soft RSC refresh failed in Production smoke.
 */
export function JobStatusChangeForm({ jobId, currentStatus, allowedNext = [] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [next, setNext] = useState(allowedNext[0] || "");

  if (allowedNext.length === 0) {
    return (
      <p className="text-sm text-muted">
        No further transitions from{" "}
        <span className="text-foreground">{jobStatusLabel(currentStatus)}</span>.
      </p>
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changeJobStatusAction(jobId, next);
      if (!result?.ok) {
        setError(
          result?.error === "invalid_transition"
            ? "That status change is not allowed."
            : "Could not update Job status."
        );
        return;
      }
      window.location.assign(`/command-center/jobs/${jobId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="next-job-status" className="mb-1.5 block text-xs font-medium text-muted">
          Change Job status
        </label>
        <select
          id="next-job-status"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
        >
          {allowedNext.map((s) => (
            <option key={s} value={s}>
              {jobStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !next}
        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300 sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Job Detail — primary worker assign / change / unassign.
 * Does not change Job status. Active workers only in the selector.
 */
export function JobAssignmentForm({
  jobId,
  assignedWorkerId = null,
  assignedDisplayName = null,
  assignedIsInactive = false,
  activeWorkers = [],
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const selectable = activeWorkers.filter((w) => w.id !== assignedWorkerId);
  const defaultNext = selectable[0]?.id || "";
  const [nextWorkerId, setNextWorkerId] = useState(defaultNext);

  function reloadJob() {
    window.location.assign(`/command-center/jobs/${jobId}`);
  }

  function onAssignOrChange(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setJobAssignedWorkerAction(jobId, nextWorkerId);
      if (!result?.ok) {
        const map = {
          worker_inactive: "That worker is inactive and cannot be assigned.",
          worker_not_found: "Worker not found.",
          not_found: "Job not found.",
        };
        setError(map[result?.error] || "Could not update assignment.");
        return;
      }
      reloadJob();
    });
  }

  function onUnassign() {
    setError(null);
    startTransition(async () => {
      const result = await setJobAssignedWorkerAction(jobId, null);
      if (!result?.ok) {
        setError("Could not unassign worker.");
        return;
      }
      reloadJob();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs text-muted">Assigned Worker</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {assignedWorkerId ? assignedDisplayName || "Unknown worker" : "Unassigned"}
          {assignedWorkerId && assignedIsInactive ? (
            <span className="ml-2 text-xs font-normal text-amber-200">Inactive</span>
          ) : null}
        </p>
      </div>

      {selectable.length === 0 && !assignedWorkerId ? (
        <p className="text-sm text-muted">
          No active workers yet. Create one under Workers, then assign here.
        </p>
      ) : null}

      {selectable.length > 0 ? (
        <form onSubmit={onAssignOrChange} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="assign-worker"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              {assignedWorkerId ? "Change worker" : "Assign worker"}
            </label>
            <select
              id="assign-worker"
              value={nextWorkerId}
              onChange={(e) => setNextWorkerId(e.target.value)}
              className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
            >
              {selectable.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.display_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending || !nextWorkerId}
            className="inline-flex w-fit rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
          >
            {pending ? "Saving…" : assignedWorkerId ? "Change" : "Assign"}
          </button>
        </form>
      ) : null}

      {assignedWorkerId ? (
        <button
          type="button"
          onClick={onUnassign}
          disabled={pending}
          className="inline-flex w-fit rounded-lg border border-border-soft px-4 py-2.5 text-sm font-medium text-muted hover:border-gold hover:text-gold-bright disabled:opacity-60"
        >
          {pending ? "Saving…" : "Unassign"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Job Detail — schedule / set date / reschedule / unschedule.
 */
export function JobScheduleForm({
  jobId,
  status,
  scheduledDate = null,
  scheduledWindow = null,
  mode = "schedule",
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [date, setDate] = useState(scheduledDate || "");
  const [windowVal, setWindowVal] = useState(scheduledWindow || "flex");

  if (mode === "readonly") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <p className="text-xs text-muted">Scheduled date</p>
          <p className="mt-0.5 text-foreground">{formatCalendarDate(scheduledDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Window</p>
          <p className="mt-0.5 text-foreground">{scheduleWindowLabel(scheduledWindow)}</p>
        </div>
        <p className="text-xs text-muted">
          Schedule is read-only while Job is {jobStatusLabel(status)}.
        </p>
      </div>
    );
  }

  function reload() {
    window.location.assign(`/command-center/jobs/${jobId}`);
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const action =
        mode === "reschedule" ? rescheduleJobAction : scheduleJobAction;
      const result = await action(jobId, date, windowVal);
      if (!result?.ok) {
        const map = {
          invalid_date: "Enter a valid date.",
          invalid_window: "Choose AM, PM, or Flex.",
          schedule_read_only: "Schedule cannot be edited in this status.",
          not_schedulable: "This Job cannot be scheduled right now.",
          not_reschedulable: "This Job cannot be rescheduled.",
        };
        setError(map[result?.error] || "Could not save schedule.");
        return;
      }
      reload();
    });
  }

  function onUnschedule() {
    setError(null);
    startTransition(async () => {
      const result = await unscheduleJobAction(jobId);
      if (!result?.ok) {
        setError("Could not unschedule Job.");
        return;
      }
      reload();
    });
  }

  const title =
    mode === "reschedule"
      ? "Reschedule"
      : mode === "set_date"
        ? "Set date"
        : "Schedule Job";

  return (
    <div className="flex flex-col gap-3">
      {!scheduledDate && status === "scheduled" ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          Needs date — status is Scheduled but no calendar date is set yet.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Current date</dt>
          <dd className="text-foreground">{formatCalendarDate(scheduledDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Current window</dt>
          <dd className="text-foreground">{scheduleWindowLabel(scheduledWindow)}</dd>
        </div>
      </dl>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="sched-date" className="mb-1.5 block text-xs font-medium text-muted">
            Date
          </label>
          <input
            id="sched-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="sched-window" className="mb-1.5 block text-xs font-medium text-muted">
            Window
          </label>
          <select
            id="sched-window"
            value={windowVal}
            onChange={(e) => setWindowVal(e.target.value)}
            className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground"
          >
            {SCHEDULE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {scheduleWindowLabel(w)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending || !date}
          className="inline-flex w-fit rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
        >
          {pending ? "Saving…" : title}
        </button>
      </form>

      {mode === "reschedule" ? (
        <button
          type="button"
          onClick={onUnschedule}
          disabled={pending}
          className="inline-flex w-fit rounded-lg border border-border-soft px-4 py-2.5 text-sm font-medium text-muted hover:border-gold hover:text-gold-bright disabled:opacity-60"
        >
          {pending ? "Saving…" : "Unschedule"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
