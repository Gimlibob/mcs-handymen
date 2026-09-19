import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import ChangePasswordForm from "@/components/cc/ChangePasswordForm";

export const metadata = {
  title: "Account",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  await requireOwner();

  return (
    <CommandCenterShell pathname="/command-center/account">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            Account
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Change the Command Center owner password. After a successful change, other
            signed-in sessions are signed out.
          </p>
        </div>
        <div className="rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Change password
          </h2>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
