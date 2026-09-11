"use server";

import { redirect } from "next/navigation";
import { getOwnerPasswordHash, verifyPassword } from "@/lib/cc/auth/password";
import { createOwnerSession, destroyOwnerSession } from "@/lib/cc/auth/session";

const LOGIN_FAIL_MESSAGE = "Invalid email or password.";

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 200);
}

function getOwnerEmail() {
  return (
    process.env.CC_OWNER_EMAIL?.trim().toLowerCase() ||
    process.env.QUOTE_NOTIFY_TO?.trim().toLowerCase() ||
    "info@mcshandymen.com"
  );
}

export async function loginAction(_prevState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? formData.get("password") : "";

  const ownerEmail = getOwnerEmail();
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

  await createOwnerSession();
  redirect("/command-center");
}

export async function logoutAction() {
  await destroyOwnerSession();
  redirect("/login");
}
