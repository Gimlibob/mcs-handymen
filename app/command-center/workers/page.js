import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { CreateWorkerForm, WorkerStatusToggle } from "@/components/cc/WorkerActions";
import { listWorkers } from "@/lib/cc/db/workers";
import { workerStatusLabel } from "@/lib/cc/domain/worker-status";

export const metadata = {
  title: "Workers",
};

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function WorkersPage() {
  await requireOwner();

  let workers = [];
  let dbError = null;

  try {
    workers = await listWorkers({ status: "all", limit: 200 });
  } catch {
    console.error("[cc/workers] list failed");
    dbError =
      "Could not load workers. If this is a new environment, apply migration 010_workers.sql.";
  }

  return (
    <CommandCenterShell pathname="/command-center/workers">
      <div className="flex flex-col gap-6 xl:gap-7">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
            Workers
          </h1>
          <p className="mt-2 text-base text-muted">
            Primary assignees for Jobs. Creating a worker does not create a login.
          </p>
        </div>

        <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Create worker
          </h2>
          <div className="mt-4">
            <CreateWorkerForm />
          </div>
        </section>

        {dbError ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {dbError}
          </p>
        ) : workers.length === 0 ? (
          <p className="text-sm text-muted">No workers yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
            {workers.map((worker) => (
              <li
                key={worker.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{worker.display_name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {workerStatusLabel(worker.status)}
                    <span className="mx-1.5 text-border-soft">·</span>
                    Added {formatDate(worker.created_at)}
                  </p>
                </div>
                <WorkerStatusToggle workerId={worker.id} status={worker.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </CommandCenterShell>
  );
}
