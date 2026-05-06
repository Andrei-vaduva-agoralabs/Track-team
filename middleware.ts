import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-config";

const PUBLIC_PATHS = ["/signin"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return NextResponse.next();
  }

  if (!request.auth) {
    const signInUrl = new URL("/signin", request.nextUrl);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/setup") && request.auth.user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
