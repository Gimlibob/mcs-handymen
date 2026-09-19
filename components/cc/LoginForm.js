"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/cc/auth/actions";

const initialState = { error: null };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="cc-email" className="mb-2 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="cc-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <div>
        <label htmlFor="cc-password" className="mb-2 block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="cc-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          className="w-full rounded-lg border border-border-soft bg-surface-2 px-4 py-3 text-base text-foreground"
        />
      </div>

      <p className="text-right text-sm">
        <a
          href="/forgot-password"
          className="font-medium text-gold-bright underline underline-offset-2"
        >
          Forgot password?
        </a>
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
