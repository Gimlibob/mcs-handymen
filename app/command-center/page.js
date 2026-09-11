import { requireOwner } from "@/lib/cc/auth/dal";
import { logoutAction } from "@/lib/cc/auth/actions";
import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: "Dashboard",
};

export default async function CommandCenterPage() {
  await requireOwner();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-soft pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-bright">
            {SITE_NAME}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">
            MCS Command Center
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Phase 1 shell — authentication is live. Pipeline and leads arrive in Phase 2–3.
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-gold hover:text-gold-bright"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-border-soft bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Status</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>Owner session: active</li>
          <li>Public site: unchanged</li>
          <li>Database: not connected yet (Phase 2)</li>
          <li>AI agents: deferred until after Phase 3 validation</li>
        </ul>
      </section>
    </div>
  );
}
