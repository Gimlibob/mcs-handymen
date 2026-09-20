import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/cc/auth/dal";
import {
  hasGoogleOAuthEnvConfigured,
  isGoogleCalendarSyncEnabled,
  isVercelPreview,
} from "@/lib/cc/google-calendar/config";
import { buildGoogleAuthUrl } from "@/lib/cc/google-calendar/oauth-client";
import {
  createOAuthState,
  oauthNonceCookieName,
  ownerSessionMarker,
} from "@/lib/cc/google-calendar/oauth-state";

export const dynamic = "force-dynamic";

/**
 * Owner-only: start Google Calendar OAuth (authorization-code, offline).
 * GET /api/google-calendar/oauth/start
 */
export async function GET() {
  try {
    const owner = await requireOwner();

    if (isVercelPreview() || !isGoogleCalendarSyncEnabled()) {
      return NextResponse.redirect(
        new URL(
          "/command-center/account?gc=disabled",
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        )
      );
    }

    if (!hasGoogleOAuthEnvConfigured()) {
      return NextResponse.redirect(
        accountRedirect("not_configured")
      );
    }

    const marker = ownerSessionMarker(owner);
    const { state, cookieValue, expiresAt } = createOAuthState({
      sessionMarker: marker,
    });
    const url = buildGoogleAuthUrl({ state, promptConsent: true });

    const res = NextResponse.redirect(url);
    res.cookies.set(oauthNonceCookieName(), cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });
    return res;
  } catch (err) {
    // requireOwner redirects on unauth; other failures → Account
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[google-calendar/oauth/start]", {
      errorClass: err?.name || "Error",
    });
    return NextResponse.redirect(accountRedirect("start_failed"));
  }
}

function accountRedirect(code) {
  const base =
    process.env.GOOGLE_REDIRECT_URI?.replace(
      /\/api\/google-calendar\/oauth\/callback\/?$/,
      ""
    ) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  return new URL(`/command-center/account?gc=${code}`, base);
}
