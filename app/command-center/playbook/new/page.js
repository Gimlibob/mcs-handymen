import Link from "next/link";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import { PlaybookCreateForm } from "@/components/cc/PlaybookForms";

export const metadata = {
  title: "New Playbook rule",
};

export const dynamic = "force-dynamic";

export default async function NewPlaybookEntryPage() {
  await requireOwner();

  return (
    <CommandCenterShell pathname="/command-center/playbook/new">
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/command-center/playbook"
            className="text-sm font-medium text-muted hover:text-gold-bright"
          >
            ← Playbook
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
            New draft rule
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Write an MCS rule or procedure in plain language. It stays a Draft until Approve exists
            in a later phase.
          </p>
        </div>

        <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <PlaybookCreateForm />
        </section>
      </div>
    </CommandCenterShell>
  );
}
