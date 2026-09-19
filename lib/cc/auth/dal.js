import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getOwnerAccount } from "@/lib/cc/db/owner-accounts";
import { destroyOwnerSession, getOwnerSession } from "@/lib/cc/auth/session";

/**
 * Secure auth check for Command Center pages and server actions.
 *
 * Auth Phase B:
 * - No owner_accounts row: HMAC session sufficient (pre-bootstrap only).
 * - Owner row exists: session.pv MUST be present and equal owner.password_version.
 *   Legacy sessions without pv are rejected (compatibility removed in Phase B).
 */
export const requireOwner = cache(async () => {
  const session = await getOwnerSession();
  if (!session) {
    redirect("/login");
  }

  const owner = await getOwnerAccount();
  if (owner) {
    if (typeof session.pv !== "number" || session.pv !== owner.password_version) {
      await destroyOwnerSession();
      redirect("/login");
    }
    return {
      role: session.role,
      exp: session.exp,
      pv: session.pv,
      ownerId: owner.id,
    };
  }

  return session;
});

export const getOptionalOwner = cache(async () => {
  const session = await getOwnerSession();
  if (!session) return null;

  const owner = await getOwnerAccount();
  if (owner) {
    if (typeof session.pv !== "number" || session.pv !== owner.password_version) {
      return null;
    }
  }
  return session;
});

export async function redirectIfAuthenticated() {
  const session = await getOwnerSession();
  if (!session) return;

  const owner = await getOwnerAccount();
  if (owner) {
    if (typeof session.pv !== "number" || session.pv !== owner.password_version) {
      return;
    }
  }
  redirect("/command-center");
}
