import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { JobAssignmentForm, JobScheduleForm, JobStatusChangeForm } from "@/components/cc/JobActions";
import { getCustomerById } from "@/lib/cc/db/customers";
import { getJobById } from "@/lib/cc/db/jobs";
import { getLeadById, getLeadPhotos } from "@/lib/cc/db/leads";
import { getWorkerById, listWorkers } from "@/lib/cc/db/workers";
import {
  canRescheduleJob,
  canScheduleJob,
  canSetScheduleDate,
  getAllowedNextJobStatusesForStatusForm,
  isScheduleReadOnly,
} from "@/lib/cc/domain/job-scheduling";
import { jobStatusLabel } from "@/lib/cc/domain/job-status";
import { statusLabel } from "@/lib/cc/domain/lead-status";

export const dynamic = "force-dynamic";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function jobBadgeTone(status) {
  if (status === "completed") return "border-emerald-500/40 text-emerald-100";
  if (status === "cancelled") return "border-red-500/40 text-red-200";
  if (status === "in_progress") return "border-amber-500/40 text-amber-100";
  if (status === "scheduled") return "border-sky-500/40 text-sky-100";
  return "border-gold-dim/50 text-gold-bright";
}

function Panel({ title, children, compact = false }) {
  return (
    <section
      className={`rounded-2xl border border-border-soft bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {title ? (
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const job = await getJobById(id);
    if (!job) return { title: "Job" };
    return { title: `Job · ${job.service_type}` };
  } catch {
    return { title: "Job" };
  }
}

export default async function JobDetailPage({ params }) {
  await requireOwner();
  const { id } = await params;

  let job;
  try {
    job = await getJobById(id);
  } catch {
    console.error("[cc/job] load failed");
    throw new Error("Unable to load job.");
  }

  if (!job) notFound();

  const [lead, customer, photos, assignee, activeWorkers] = await Promise.all([
    getLeadById(job.lead_id),
    getCustomerById(job.customer_id),
    getLeadPhotos(job.lead_id).catch(() => []),
    job.assigned_worker_id
      ? getWorkerById(job.assigned_worker_id).catch(() => null)
      : Promise.resolve(null),
    listWorkers({ status: "active", limit: 200 }).catch(() => []),
  ]);

  const allowedNext = getAllowedNextJobStatusesForStatusForm(job.status);

  let scheduleMode = "readonly";
  if (canScheduleJob(job)) scheduleMode = "schedule";
  else if (canSetScheduleDate(job)) scheduleMode = "set_date";
  else if (canRescheduleJob(job)) scheduleMode = "reschedule";
  else if (isScheduleReadOnly(job) || job.status === "authorized") scheduleMode = "readonly";

  return (
    <CommandCenterShell pathname={`/command-center/jobs/${job.id}`}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={lead ? `/command-center/leads/${lead.id}` : "/command-center/leads"}
            className="text-sm font-medium text-muted hover:text-gold-bright"
          >
            ← {lead ? "Back to Lead" : "Leads"}
          </Link>

          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
                  Job
                </h1>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${jobBadgeTone(
                    job.status
                  )}`}
                >
                  {jobStatusLabel(job.status)}
                </span>
              </div>
              <p className="mt-2 text-base text-muted">
                {job.service_city} · {job.service_type}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">{job.id}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-4">
            <Panel title="Status" compact>
              <div className="mb-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-medium ${jobBadgeTone(
                    job.status
                  )}`}
                >
                  {jobStatusLabel(job.status)}
                </span>
              </div>
              <dl className="mb-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Authorized</dt>
                  <dd className="text-right text-foreground">
                    {formatDateTime(job.authorized_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Updated</dt>
                  <dd className="text-right text-foreground">
                    {formatDateTime(job.updated_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Completed</dt>
                  <dd className="text-right text-foreground">
                    {formatDateTime(job.completed_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Cancelled</dt>
                  <dd className="text-right text-foreground">
                    {formatDateTime(job.cancelled_at)}
                  </dd>
                </div>
              </dl>
              <div className="border-t border-border-soft pt-4">
                <JobStatusChangeForm
                  jobId={job.id}
                  currentStatus={job.status}
                  allowedNext={allowedNext}
                />
              </div>
            </Panel>

            <Panel title="Assigned Worker" compact>
              <JobAssignmentForm
                jobId={job.id}
                assignedWorkerId={job.assigned_worker_id || null}
                assignedDisplayName={assignee?.display_name || null}
                assignedIsInactive={assignee?.status === "inactive"}
                activeWorkers={activeWorkers}
              />
            </Panel>

            <Panel title="Schedule" compact>
              <JobScheduleForm
                jobId={job.id}
                status={job.status}
                scheduledDate={job.scheduled_date || null}
                scheduledWindow={job.scheduled_window || null}
                mode={scheduleMode}
              />
            </Panel>

            <Panel title="Relationships" compact>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Customer</dt>
                  <dd className="mt-0.5">
                    {customer ? (
                      <Link
                        href={`/command-center/customers/${customer.id}`}
                        className="font-medium text-gold-bright hover:underline"
                      >
                        {customer.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted">Customer not found</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Originating Lead</dt>
                  <dd className="mt-0.5">
                    {lead ? (
                      <>
                        <Link
                          href={`/command-center/leads/${lead.id}`}
                          className="font-medium text-gold-bright hover:underline"
                        >
                          {lead.full_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          Lead status: {statusLabel(lead.status)}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted">Lead not found</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2 xl:col-span-8">
            <Panel title="Authorized scope (snapshot)">
              <p className="-mt-1 mb-3 text-xs text-muted">
                Frozen at Job creation. Lead description edits do not change this text.
              </p>
              <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Service</dt>
                  <dd className="mt-0.5 text-foreground">{job.service_type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Property type</dt>
                  <dd className="mt-0.5 text-foreground">{job.property_type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Service city</dt>
                  <dd className="mt-0.5 text-foreground">{job.service_city}</dd>
                </div>
              </dl>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {job.scope_summary}
              </p>
            </Panel>

            <Panel title="Lead photos">
              <p className="-mt-1 mb-3 text-xs text-muted">
                Quote photos remain Lead-owned. Shown here by reference only.
              </p>
              {photos.length === 0 ? (
                <p className="text-sm text-muted">No photos on the originating lead.</p>
              ) : (
                <ul
                  className={`grid gap-4 ${
                    photos.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"
                  }`}
                >
                  {photos.map((photo, index) => (
                    <li
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-border-soft bg-surface-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/cc/lead-photos/${photo.id}`}
                        alt={`Lead photo ${index + 1}`}
                        className={`w-full object-cover ${
                          photos.length === 1
                            ? "max-h-[420px] object-contain bg-surface-2"
                            : "aspect-[4/3]"
                        }`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
