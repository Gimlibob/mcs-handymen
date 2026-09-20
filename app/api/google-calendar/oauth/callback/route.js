import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireOwner } from "@/lib/cc/auth/dal";
import {
  getAllowedGoogleAccountEmail,
  hasGoogleOAuthEnvConfigured,
  isGoogleCalendarSyncEnabled,
  isVercelPreview,
} from "@/lib/cc/google-calendar/config";
import {
  createGoogleOAuth2Client,
  exchangeGoogleAuthCode,
  fetchGoogleAccountIdentity,
} from "@/lib/cc/google-calendar/oauth-client";
import {
  oauthNonceCookieName,
  ownerSessionMarker,
  validateOAuthState,
} from "@/lib/cc/google-calendar/oauth-state";
import { finalizeOAuthConnection } from "@/lib/cc/google-calendar/connection-service";

export const dynamic = "force-dynamic";

const ACCOUNT_PATH = "/command-center/account";

function accountUrl(query) {
  const base =
    process.env.GOOGLE_REDIRECT_URI?.replace(
      /\/api\/google-calendar\/oauth\/callback\/?$/,
      ""
    ) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const u = new URL(ACCOUNT_PATH, base);
  for (const [k, v] of Object.entries(query)) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  return u;
}

function clearNonce(res) {
  res.cookies.set(oauthNonceCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/**
 * OAuth callback — fixed Account redirect only.
 * GET /api/google-calendar/oauth/callback
 */
export async function GET(request) {
  let res;

  try {
    if (isVercelPreview() || !isGoogleCalendarSyncEnabled()) {
      res = NextResponse.redirect(accountUrl({ gc: "disabled" }));
      return clearNonce(res);
    }

    const owner = await requireOwner();
    const { searchParams } = new URL(request.url);

    const oauthError = searchParams.get("error");
    if (oauthError) {
      res = NextResponse.redirect(
        accountUrl({
          gc: oauthError === "access_denied" ? "denied" : "oauth_error",
        })
      );
      return clearNonce(res);
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      res = NextResponse.redirect(accountUrl({ gc: "missing_code" }));
      return clearNonce(res);
    }

    if (!hasGoogleOAuthEnvConfigured()) {
      res = NextResponse.redirect(accountUrl({ gc: "not_configured" }));
      return clearNonce(res);
    }

    const jar = await cookies();
    const cookieNonce = jar.get(oauthNonceCookieName())?.value || null;
    const marker = ownerSessionMarker(owner);
    const validated = validateOAuthState({
      state,
      cookieNonce,
      sessionMarker: marker,
    });

    if (!validated.ok) {
      res = NextResponse.redirect(accountUrl({ gc: validated.error || "invalid_state" }));
      return clearNonce(res);
    }

    let tokens;
    try {
      tokens = await exchangeGoogleAuthCode(code);
    } catch (err) {
      console.error("[google-calendar/oauth/callback] exchange", {
        errorClass: err?.name || "Error",
        status: err?.response?.status || null,
      });
      res = NextResponse.redirect(accountUrl({ gc: "exchange_failed" }));
      return clearNonce(res);
    }

    if (!tokens?.refresh_token) {
      res = NextResponse.redirect(accountUrl({ gc: "missing_refresh_token" }));
      return clearNonce(res);
    }

    const auth = createGoogleOAuth2Client();
    auth.setCredentials(tokens);

    let identity;
    try {
      identity = await fetchGoogleAccountIdentity(auth);
    } catch (err) {
      console.error("[google-calendar/oauth/callback] identity", {
        errorClass: err?.name || "Error",
      });
      res = NextResponse.redirect(accountUrl({ gc: "identity_failed" }));
      return clearNonce(res);
    }

    const allowed = getAllowedGoogleAccountEmail();
    if (!identity.email || identity.email !== allowed) {
      // Do not persist token / do not create calendar
      res = NextResponse.redirect(accountUrl({ gc: "wrong_account" }));
      return clearNonce(res);
    }

    const result = await finalizeOAuthConnection({
      email: identity.email,
      sub: identity.sub,
      refreshToken: tokens.refresh_token,
    });

    if (result.ok) {
      res = NextResponse.redirect(accountUrl({ gc: "connected" }));
      return clearNonce(res);
    }

    if (result.needsRepair || result.error === "calendar_missing") {
      res = NextResponse.redirect(accountUrl({ gc: "calendar_missing" }));
      return clearNonce(res);
    }

    res = NextResponse.redirect(accountUrl({ gc: "setup_error" }));
    return clearNonce(res);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[google-calendar/oauth/callback]", {
      errorClass: err?.name || "Error",
    });
    res = NextResponse.redirect(accountUrl({ gc: "callback_failed" }));
    return clearNonce(res);
  }
}
