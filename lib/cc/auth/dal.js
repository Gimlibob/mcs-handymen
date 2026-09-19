import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getOwnerAccount } from "@/lib/cc/db/owner-accounts";
import { destroyOwnerSession, getOwnerSession } from "@/lib/cc/auth/session";

/**
 * Secure auth check for Command Center pages and server actions.
 * Call this close to data / mutations — not only in layouts.
 *
 * Auth Phase A password_version rules:
 * - No owner_accounts row: HMAC session sufficient (env-only era / pre-bootstrap).
 * - Owner row exists + session.pv present: must equal owner.password_version.
 * - Owner row exists + session.pv null (legacy cookie): temporarily allowed in Phase A
 *   so deploying this code does not lock out existing Production sessions.
 *   Later phases (change/reset password) will stop issuing legacy cookies and can
 *   remove this compatibility path after a cutover window.
 */
export const requireOwner = cache(async () => {
  const session = await getOwnerSession();
  if (!session) {
    redirect("/login");
  }

  const owner = await getOwnerAccount();
  if (owner) {
    if (typeof session.pv === "number") {
      if (session.pv !== owner.password_version) {
        await destroyOwnerSession();
        redirect("/login");
      }
    }
    // Legacy session without pv: allowed during Phase A only.
    return {
      role: session.role,
      exp: session.exp,
      pv: session.pv,
      ownerId: owner.id,
      legacySession: session.pv == null,
    };
  }

  return session;
});

export const getOptionalOwner = cache(async () => {
  const session = await getOwnerSession();
  if (!session) return null;

  const owner = await getOwnerAccount();
  if (owner && typeof session.pv === "number" && session.pv !== owner.password_version) {
    return null;
  }
  return session;
});

export async function redirectIfAuthenticated() {
  const session = await getOwnerSession();
  if (!session) return;

  const owner = await getOwnerAccount();
  if (owner && typeof session.pv === "number" && session.pv !== owner.password_version) {
    return;
  }
  redirect("/command-center");
}
