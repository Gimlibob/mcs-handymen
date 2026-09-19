"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/cc/actions/owner-account";

const initialState = { ok: false, message: null };

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-gold-dim/40 bg-surface-2 px-3 py-2 text-sm text-foreground"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
