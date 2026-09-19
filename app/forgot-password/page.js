import Link from "next/link";
import ForgotPasswordForm from "@/components/cc/ForgotPasswordForm";
import { SITE_NAME } from "@/lib/site-config";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-bright">
          {SITE_NAME}
        </p>
        <h1 className="mt-3 text-center font-heading text-3xl font-bold text-foreground">
          Forgot password
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Enter the owner email. If an account exists, a reset link will be sent.
        </p>
        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6">
          <ForgotPasswordForm />
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
