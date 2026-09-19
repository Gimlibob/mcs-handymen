import Link from "next/link";
import ResetPasswordForm from "@/components/cc/ResetPasswordForm";
import { getResetTokenByRaw } from "@/lib/cc/db/owner-password-reset-tokens";
import { SITE_NAME } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const row = token ? await getResetTokenByRaw(token) : null;
  const now = Date.now();
  const valid =
    row &&
    !row.used_at &&
    new Date(row.expires_at).getTime() > now;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-bright">
          {SITE_NAME}
        </p>
        <h1 className="mt-3 text-center font-heading text-3xl font-bold text-foreground">
          Reset password
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Choose a new Command Center owner password.
        </p>
        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p role="alert" className="text-sm text-red-200">
              This reset link is invalid or has expired. Request a new link from the sign-in
              page.
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-gold-bright underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
