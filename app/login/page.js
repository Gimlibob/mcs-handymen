import { redirectIfAuthenticated } from "@/lib/cc/auth/dal";
import LoginForm from "@/components/cc/LoginForm";
import { SITE_NAME } from "@/lib/site-config";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-bright">
          {SITE_NAME}
        </p>
        <h1 className="mt-3 text-center font-heading text-3xl font-bold text-foreground">
          Command Center
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Owner sign-in. This area is not part of the public website.
        </p>
        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
