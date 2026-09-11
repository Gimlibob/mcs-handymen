import { NextResponse } from "next/server";
import { CC_SESSION_COOKIE } from "@/lib/cc/auth/constants";
import { decodeSessionToken } from "@/lib/cc/auth/session";

/**
 * Optimistic auth gate for Command Center only.
 * Matcher excludes the public marketing site so a proxy failure cannot take it down.
 * Secure checks still happen in requireOwner() / API handlers.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  const isCommandCenter = pathname === "/command-center" || pathname.startsWith("/command-center/");
  const isCcApi = pathname === "/api/cc" || pathname.startsWith("/api/cc/");
  const isLogin = pathname === "/login";

  if (!isCommandCenter && !isCcApi && !isLogin) {
    return NextResponse.next();
  }

  const token = request.cookies.get(CC_SESSION_COOKIE)?.value;
  let session = null;
  try {
    session = decodeSessionToken(token);
  } catch {
    session = null;
  }

  if ((isCommandCenter || isCcApi) && !session) {
    if (isCcApi) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && session) {
    return NextResponse.redirect(new URL("/command-center", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/command-center", "/command-center/:path*", "/api/cc", "/api/cc/:path*", "/login"],
};
