import Link from "next/link";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { PlaybookFilters, PlaybookTable } from "@/components/cc/PlaybookTable";
import { listPlaybookEntries } from "@/lib/cc/db/playbook";
import {
  isValidPlaybookCategory,
  isValidPlaybookRevisionStatus,
  isValidPlaybookSensitivity,
  isValidPlaybookValidationState,
} from "@/lib/cc/domain/playbook";

export const metadata = {
  title: "Playbook",
};

export const dynamic = "force-dynamic";

export default async function PlaybookListPage({ searchParams }) {
  await requireOwner();

  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const category =
    typeof params?.category === "string" && isValidPlaybookCategory(params.category)
      ? params.category
      : "";
  const serviceKey = typeof params?.service === "string" ? params.service : "";
  const validationState =
    typeof params?.validation === "string" && isValidPlaybookValidationState(params.validation)
      ? params.validation
      : "";
  const sensitivity =
    typeof params?.sensitivity === "string" && isValidPlaybookSensitivity(params.sensitivity)
      ? params.sensitivity
      : "";
  const revisionStatus =
    typeof params?.status === "string" && isValidPlaybookRevisionStatus(params.status)
      ? params.status
      : "";

  let entries = [];
  let dbError = null;

  try {
    entries = await listPlaybookEntries({
      q,
      category: category || undefined,
      serviceKey: serviceKey || undefined,
      validationState: validationState || undefined,
      sensitivity: sensitivity || undefined,
      revisionStatus: revisionStatus || undefined,
      limit: 100,
    });
  } catch {
    console.error("[cc/playbook] list failed");
    dbError = "Could not load Playbook rules.";
  }

  return (
    <CommandCenterShell pathname="/command-center/playbook">
      <div className="flex flex-col gap-6 xl:gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
              Playbook
            </h1>
            <p className="mt-2 max-w-3xl text-base text-muted">
              MCS rules and procedures. Mark a rule Validated, then Approve a draft so agents can use
              it. Hypothesis and discussion stay owner-only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted tabular-nums">
              <span className="font-semibold text-foreground">{entries.length}</span> shown
            </p>
            <Link
              href="/command-center/playbook/new"
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright"
            >
              New draft rule
            </Link>
          </div>
        </div>

        <PlaybookFilters
          q={q}
          category={category}
          serviceKey={serviceKey}
          validationState={validationState}
          sensitivity={sensitivity}
          revisionStatus={revisionStatus}
        />

        {dbError ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {dbError}
          </p>
        ) : (
          <PlaybookTable entries={entries} />
        )}
      </div>
    </CommandCenterShell>
  );
}
