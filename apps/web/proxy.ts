import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";

const PUBLIC_PATHS = new Set<string>(["/login", "/forbidden"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/api/");
}

function isProtectedPath(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return false;
  }

  if (pathname.startsWith("/_next/")) {
    return false;
  }

  if (pathname === "/favicon.ico") {
    return false;
  }

  // Skip direct asset requests such as /logo.png or /font.woff2
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return false;
  }

  const matchesRoute = (route: string) =>
    pathname === route || pathname.startsWith(`${route}/`);

  return (
    pathname === "/" ||
    matchesRoute("/dashboard") ||
    matchesRoute("/units") ||
    matchesRoute("/countdown") ||
    matchesRoute("/job-plan") ||
    matchesRoute("/spk") ||
    matchesRoute("/wo") ||
    matchesRoute("/pr") ||
    matchesRoute("/vendor") ||
    matchesRoute("/warehouse") ||
    matchesRoute("/reports") ||
    matchesRoute("/monitoring") ||
    matchesRoute("/issues") ||
    matchesRoute("/settings") ||
    matchesRoute("/planning") ||
    matchesRoute("/gallery")
  );
}

export function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
