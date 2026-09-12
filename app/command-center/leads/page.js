import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import LeadsFilters, { LeadsTable } from "@/components/cc/LeadsTable";
import { listLeads } from "@/lib/cc/db/leads";
import { isValidLeadStatus } from "@/lib/cc/domain/lead-status";

export const metadata = {
  title: "Leads",
};

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }) {
  await requireOwner();

  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const status =
    typeof params?.status === "string" && isValidLeadStatus(params.status) ? params.status : "";

  let leads = [];
  let dbError = null;

  try {
    leads = await listLeads({ q, status: status || undefined, limit: 100 });
  } catch {
    console.error("[cc/leads] list failed");
    dbError = "Could not load leads.";
  }

  return (
    <CommandCenterShell pathname="/command-center/leads">
      <div className="flex flex-col gap-6 xl:gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
              Leads
            </h1>
            <p className="mt-2 text-base text-muted">
              Website quote requests from Neon. Click a row to open the full file.
            </p>
          </div>
          <p className="text-sm text-muted tabular-nums">
            <span className="font-semibold text-foreground">{leads.length}</span> shown
          </p>
        </div>

        <LeadsFilters q={q} status={status} />

        {dbError ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {dbError}
          </p>
        ) : (
          <LeadsTable leads={leads} />
        )}
      </div>
    </CommandCenterShell>
  );
}
