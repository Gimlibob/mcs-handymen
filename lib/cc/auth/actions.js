"use server";

import { redirect } from "next/navigation";
import { getOwnerAccount } from "@/lib/cc/db/owner-accounts";
import { getOwnerPasswordHash, verifyPassword } from "@/lib/cc/auth/password";
import { createOwnerSession, destroyOwnerSession } from "@/lib/cc/auth/session";
import { normalizeOwnerEmail } from "@/lib/cc/domain/owner-account";

const LOGIN_FAIL_MESSAGE = "Invalid email or password.";

/**
 * Env-only login email (pre-bootstrap fallback only).
 * Once owner_accounts has a row, DB email is authoritative — this is not used.
 */
function getEnvOwnerEmail() {
  return (
    process.env.CC_OWNER_EMAIL?.trim().toLowerCase() ||
    process.env.QUOTE_NOTIFY_TO?.trim().toLowerCase() ||
    "info@mcshandymen.com"
  );
}

export async function loginAction(_prevState, formData) {
  const email = normalizeOwnerEmail(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? formData.get("password") : "";

  const dbOwner = await getOwnerAccount();

  if (dbOwner) {
    // DB is authoritative after bootstrap — env hash cannot bypass.
    const passwordOk = verifyPassword(password, dbOwner.password_hash);
    const emailOk = email === dbOwner.email_normalized && email.length > 0;

    if (!passwordOk || !emailOk) {
      return { error: LOGIN_FAIL_MESSAGE };
    }

    await createOwnerSession({ passwordVersion: dbOwner.password_version });
    redirect("/command-center");
  }

  // Pre-bootstrap: retain env-based owner login.
  const ownerEmail = getEnvOwnerEmail();
  const passwordHash = getOwnerPasswordHash();

  if (!passwordHash) {
    console.error("[cc/auth] CC_OWNER_PASSWORD_HASH is not configured");
    return { error: "Command Center login is temporarily unavailable." };
  }

  // Always verify password (even on email mismatch) to avoid easy timing leaks.
  const passwordOk = verifyPassword(password, passwordHash);
  const emailOk = email === ownerEmail && email.length > 0;

  if (!passwordOk || !emailOk) {
    return { error: LOGIN_FAIL_MESSAGE };
  }

  // Env-only session omits pv (legacy-compatible).
  await createOwnerSession();
  redirect("/command-center");
}

export async function logoutAction() {
  await destroyOwnerSession();
  redirect("/login");
}
