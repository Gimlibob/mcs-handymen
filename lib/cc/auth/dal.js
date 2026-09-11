import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/cc/auth/session";

/**
 * Secure auth check for Command Center pages and server actions.
 * Call this close to data / mutations — not only in layouts.
 */
export const requireOwner = cache(async () => {
  const session = await getOwnerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

export const getOptionalOwner = cache(async () => {
  return getOwnerSession();
});

export async function redirectIfAuthenticated() {
  const session = await getOwnerSession();
  if (session) {
    redirect("/command-center");
  }
}
