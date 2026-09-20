/**
 * Google OAuth2 client helpers (server-only usage).
 */

import { google } from "googleapis";
import {
  getGoogleOAuthRedirectUri,
  GOOGLE_OAUTH_SCOPES,
  hasGoogleOAuthEnvConfigured,
} from "./config.js";

export function createGoogleOAuth2Client() {
  if (!hasGoogleOAuthEnvConfigured()) {
    throw new Error("google_oauth_env_incomplete");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID.trim(),
    process.env.GOOGLE_CLIENT_SECRET.trim(),
    getGoogleOAuthRedirectUri()
  );
}

/**
 * @param {{ state: string, promptConsent?: boolean }} args
 */
export function buildGoogleAuthUrl({ state, promptConsent = true }) {
  const client = createGoogleOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    scope: GOOGLE_OAUTH_SCOPES,
    state,
    prompt: promptConsent ? "consent" : undefined,
  });
}

/**
 * @param {string} code
 */
export async function exchangeGoogleAuthCode(code) {
  const client = createGoogleOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * @param {string} refreshToken
 */
export function oauthClientWithRefreshToken(refreshToken) {
  const client = createGoogleOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * Fetch user email/sub via OAuth2 userinfo.
 * @param {import('google-auth-library').OAuth2Client} auth
 */
export async function fetchGoogleAccountIdentity(auth) {
  const oauth2 = google.oauth2({ version: "v2", auth });
  const res = await oauth2.userinfo.get();
  const email =
    typeof res.data?.email === "string"
      ? res.data.email.trim().toLowerCase()
      : null;
  const sub =
    typeof res.data?.id === "string" ? res.data.id.trim() : null;
  return { email, sub };
}

/**
 * Best-effort refresh-token revocation (disconnect).
 * @param {string} refreshTokenPlaintext
 */
export async function revokeGoogleRefreshToken(refreshTokenPlaintext) {
  if (!refreshTokenPlaintext || typeof refreshTokenPlaintext !== "string") {
    return { ok: false, error: "missing_token" };
  }
  const client = createGoogleOAuth2Client();
  await client.revokeToken(refreshTokenPlaintext);
  return { ok: true };
}
