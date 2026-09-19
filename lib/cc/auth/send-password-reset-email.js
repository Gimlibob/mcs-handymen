import { Resend } from "resend";
import { BACKUP_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site-config";

/**
 * Send owner password-reset email via Resend.
 * Reset link always uses SITE_URL (canonical Production origin).
 * Never builds the link from incoming HTTP host headers.
 *
 * @param {{ to: string, rawToken: string }} args
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function sendPasswordResetEmail({ to, rawToken }) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error("[cc/auth] RESEND_API_KEY is not configured");
    return { ok: false, error: "email_unavailable" };
  }
  if (typeof to !== "string" || !to.includes("@")) {
    return { ok: false, error: "invalid_to" };
  }
  if (typeof rawToken !== "string" || rawToken.length < 16) {
    return { ok: false, error: "invalid_token" };
  }

  const resetUrl = `${SITE_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const fromAddress =
    process.env.RESEND_FROM?.trim() || `${SITE_NAME} <${BACKUP_EMAIL}>`;

  const text = [
    `${SITE_NAME} — Command Center password reset`,
    "",
    "We received a request to reset the Command Center owner password.",
    "",
    `Open this link within 30 minutes to choose a new password:`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "Your current password will remain unchanged.",
  ].join("\n");

  const html = `
    <p><strong>${SITE_NAME}</strong> — Command Center password reset</p>
    <p>We received a request to reset the Command Center owner password.</p>
    <p><a href="${resetUrl}">Reset your password</a> (link expires in 30 minutes).</p>
    <p>If you did not request this, you can ignore this email. Your current password will remain unchanged.</p>
  `.trim();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `${SITE_NAME} — Reset your Command Center password`,
      text,
      html,
    });
    if (error) {
      console.error("[cc/auth] password reset email failed");
      return { ok: false, error: "send_failed" };
    }
    return { ok: true };
  } catch {
    console.error("[cc/auth] password reset email threw");
    return { ok: false, error: "send_failed" };
  }
}
