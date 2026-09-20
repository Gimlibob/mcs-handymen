/**
 * Google Calendar sync configuration (GC-2).
 */

export const GOOGLE_CALENDAR_APP_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  GOOGLE_CALENDAR_APP_SCOPE,
];

export const DEFAULT_ALLOWED_GOOGLE_ACCOUNT_EMAIL = "info@mcshandymen.com";

export function getAllowedGoogleAccountEmail() {
  const raw = process.env.GOOGLE_ALLOWED_ACCOUNT_EMAIL?.trim();
  return (raw || DEFAULT_ALLOWED_GOOGLE_ACCOUNT_EMAIL).toLowerCase();
}

export function isGoogleCalendarSyncEnabled() {
  if ((process.env.VERCEL_ENV || "").toLowerCase() === "preview") {
    return false;
  }
  return process.env.GOOGLE_CALENDAR_SYNC_ENABLED?.trim() === "true";
}

export function isVercelPreview() {
  return (process.env.VERCEL_ENV || "").toLowerCase() === "preview";
}

export function getMcsGoogleEnvLabel() {
  if ((process.env.VERCEL_ENV || "").toLowerCase() === "production") {
    return "production";
  }
  return "development";
}

export function getMcsJobsCalendarSummary() {
  return getMcsGoogleEnvLabel() === "production" ? "MCS Jobs" : "MCS Jobs DEV";
}

export function getGoogleOAuthRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || "";
}

export function hasGoogleOAuthEnvConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REDIRECT_URI?.trim() &&
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
  );
}

export const CONNECTION_STATUSES = [
  "connected",
  "disconnected",
  "revoked",
  "error",
];

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
