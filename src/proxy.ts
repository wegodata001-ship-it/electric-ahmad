import { NextResponse, type NextRequest } from "next/server";
import {
  FIELD_SESSION_COOKIE,
  verifyFieldSession,
} from "@/lib/auth/field-cookie";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
} from "@/lib/auth/office-cookie";

function isPublicFieldPath(pathname: string): boolean {
  return (
    pathname === "/field/login" ||
    pathname === "/api/field/auth/login" ||
    pathname === "/api/field/auth/logout"
  );
}

function isPublicOfficePath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/manager" ||
    pathname === "/manager/" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/health" ||
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/api/sign/")
  );
}

/** Field UI + all Field APIs (including journals under /api/field/*) */
function isFieldPath(pathname: string): boolean {
  return (
    pathname === "/field" ||
    pathname.startsWith("/field/") ||
    pathname === "/api/field" ||
    pathname.startsWith("/api/field/")
  );
}

function isWorkerPath(pathname: string): boolean {
  return pathname === "/worker" || pathname.startsWith("/worker/");
}

function isOfficeAliasPath(pathname: string): boolean {
  return (
    pathname === "/project-manager" ||
    pathname === "/project-manager/" ||
    pathname === "/manager" ||
    pathname === "/manager/"
  );
}

async function handleFieldAuth(request: NextRequest, pathname: string) {
  const isFieldApi =
    pathname.startsWith("/api/field/") || pathname === "/api/field";

  if (isPublicFieldPath(pathname)) {
    if (pathname === "/field/login") {
      const token = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
      const session = await verifyFieldSession(token);
      if (session) {
        return NextResponse.redirect(new URL("/field", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
  const session = await verifyFieldSession(token);

  if (!session) {
    if (isFieldApi) {
      return NextResponse.json(
        { success: false, error: "נדרשת התחברות למערכת מנהל העבודה" },
        { status: 401 }
      );
    }
    const login = new URL("/field/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

async function handleOfficeAuth(request: NextRequest, pathname: string) {
  const isApi = pathname.startsWith("/api/");

  if (isPublicOfficePath(pathname)) {
    if (pathname === "/login") {
      const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
      const session = await verifyOfficeSession(token);
      if (session) {
        const next = request.nextUrl.searchParams.get("next");
        const dest =
          next &&
          next.startsWith("/") &&
          !next.startsWith("//") &&
          next !== "/login"
            ? next
            : "/dashboard";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
    if (pathname === "/manager" || pathname === "/manager/") {
      const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
      const session = await verifyOfficeSession(token);
      if (session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (isOfficeAliasPath(pathname)) {
    const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
    const session = await verifyOfficeSession(token);
    if (!session) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/dashboard");
      return NextResponse.redirect(login);
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
  const session = await verifyOfficeSession(token);

  if (!session) {
    if (isApi) {
      return NextResponse.json(
        { success: false, error: "נדרשת התחברות למערכת מנהל הפרויקט" },
        { status: 401 }
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 * Auth failures → redirect (pages) or 401 (APIs). Never 404.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public client signature pages / APIs — no login
  if (pathname.startsWith("/sign/") || pathname.startsWith("/api/sign/")) {
    return NextResponse.next();
  }

  // Field system first — never falls through to office session checks
  if (isFieldPath(pathname)) {
    return handleFieldAuth(request, pathname);
  }

  if (isWorkerPath(pathname)) {
    return NextResponse.next();
  }

  return handleOfficeAuth(request, pathname);
}

export const config = {
  matcher: [
    /*
     * Run on app routes + APIs.
     * Skip Next internals, generated icons, and static files (with extensions).
     */
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\..*).*)",
  ],
};
