"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/cc/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/cc/auth/password";
import { createOwnerSession, destroyOwnerSession } from "@/lib/cc/auth/session";
import { sendPasswordResetEmail } from "@/lib/cc/auth/send-password-reset-email";
import {
  getOwnerAccount,
  getOwnerByEmailNormalized,
  updateOwnerPasswordHash,
} from "@/lib/cc/db/owner-accounts";
import {
  FORGOT_PASSWORD_MAX_PER_WINDOW,
  countRecentResetTokenRequests,
  createPasswordResetToken,
  getValidResetTokenByRaw,
  resetOwnerPasswordWithToken,
} from "@/lib/cc/db/owner-password-reset-tokens";
import { normalizeOwnerEmail } from "@/lib/cc/domain/owner-account";

const GENERIC_FORGOT_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

function readPassword(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validateNewPasswordPair(password, confirm) {
  if (password.length < 10) {
    return "Password must be at least 10 characters.";
  }
  if (password !== confirm) {
    return "New password and confirmation do not match.";
  }
  return null;
}

export async function changePasswordAction(_prevState, formData) {
  await requireOwner();

  const currentPassword = readPassword(formData, "currentPassword");
  const newPassword = readPassword(formData, "newPassword");
  const confirmPassword = readPassword(formData, "confirmPassword");

  const pairError = validateNewPasswordPair(newPassword, confirmPassword);
  if (pairError) return { error: pairError };

  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current password." };
  }

  const owner = await getOwnerAccount();
  if (!owner) {
    return { error: "Owner account is not available." };
  }

  if (!verifyPassword(currentPassword, owner.password_hash)) {
    return { error: "Current password is incorrect." };
  }

  let passwordHash;
  try {
    passwordHash = hashPassword(newPassword);
  } catch {
    return { error: "Password must be at least 10 characters." };
  }

  const updated = await updateOwnerPasswordHash({
    ownerId: owner.id,
    passwordHash,
    expectedVersion: owner.password_version,
  });
  if (!updated.ok) {
    return { error: "Unable to update password. Please try again." };
  }

  await createOwnerSession({ passwordVersion: updated.owner.password_version });
  return { ok: true, message: "Password updated." };
}

export async function forgotPasswordAction(_prevState, formData) {
  const email = normalizeOwnerEmail(formData.get("email"));

  // Always return generic success to the client.
  const generic = { ok: true, message: GENERIC_FORGOT_MESSAGE };

  if (!email) {
    return generic;
  }

  try {
    const owner = await getOwnerByEmailNormalized(email);
    if (!owner) {
      return generic;
    }

    const recent = await countRecentResetTokenRequests(owner.id);
    if (recent >= FORGOT_PASSWORD_MAX_PER_WINDOW) {
      // Still generic — do not reveal throttle to the public response.
      return generic;
    }

    const created = await createPasswordResetToken(owner.id);
    if (!created.ok) {
      return generic;
    }

    await sendPasswordResetEmail({
      to: owner.email_normalized,
      rawToken: created.rawToken,
    });
  } catch {
    console.error("[cc/auth] forgotPasswordAction failed");
  }

  return generic;
}

export async function resetPasswordAction(_prevState, formData) {
  const rawToken =
    typeof formData.get("token") === "string" ? formData.get("token") : "";
  const newPassword = readPassword(formData, "newPassword");
  const confirmPassword = readPassword(formData, "confirmPassword");

  const pairError = validateNewPasswordPair(newPassword, confirmPassword);
  if (pairError) return { error: pairError };

  const tokenRow = await getValidResetTokenByRaw(rawToken);
  if (!tokenRow) {
    return { error: "This reset link is invalid or has expired." };
  }

  const owner = await getOwnerAccount();
  if (!owner || owner.id !== tokenRow.owner_id) {
    return { error: "This reset link is invalid or has expired." };
  }

  let passwordHash;
  try {
    passwordHash = hashPassword(newPassword);
  } catch {
    return { error: "Password must be at least 10 characters." };
  }

  const result = await resetOwnerPasswordWithToken({
    ownerId: owner.id,
    tokenId: tokenRow.id,
    passwordHash,
    expectedVersion: owner.password_version,
  });

  if (!result.ok) {
    return { error: "This reset link is invalid or has expired." };
  }

  await destroyOwnerSession();
  redirect("/login?reset=1");
}
