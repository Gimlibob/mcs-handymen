"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/cc/actions/owner-account";

const initialState = { error: null, ok: false, message: null };

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-gold-dim/40 bg-surface-2 px-3 py-2 text-sm text-gold-bright"
        >
          {state.message || "Password updated."}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="currentPassword"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
