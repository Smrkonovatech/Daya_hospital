import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

const PROTECTED_PREFIXES = [
  "/overview",
  "/calls",
  "/actions",
  "/knowledge-base",
  "/knowledge",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // If user is already authenticated and visits /login, redirect to /overview
  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
    return NextResponse.next();
  }

  // Root redirect
  if (pathname === "/") {
    if (session) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check if route is protected
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png (hospital logo)
     * - api routes (handled directly by API handlers for proper 401/403 JSON responses)
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png|api/).*)",
  ],
};
