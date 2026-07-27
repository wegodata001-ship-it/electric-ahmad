import { NextResponse, type NextRequest } from "next/server";
import {
  FIELD_SESSION_COOKIE,
  verifyFieldSession,
} from "@/lib/auth/field-cookie";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
} from "@/lib/auth/office-cookie";
import { portalHomeForRole } from "@/lib/portals/config";

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

function isSafeInternalPath(next: string | null): next is string {
  return (
    !!next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    next !== "/login" &&
    next !== "/field/login"
  );
}

function isFieldOnlyPath(pathname: string): boolean {
  return (
    pathname === "/field" ||
    pathname.startsWith("/field/") ||
    pathname === "/api/field" ||
    pathname.startsWith("/api/field/")
  );
}

/**
 * Honor `next` only when it belongs to the same portal family.
 * Mixing field `next=/dashboard` with a field session caused ERR_TOO_MANY_REDIRECTS:
 * /login → /dashboard → /login?next=/dashboard → …
 */
function safeNextPath(
  next: string | null,
  fallback: string,
  kind: "field" | "office"
): string {
  if (!isSafeInternalPath(next)) return fallback;
  if (kind === "field") {
    return isFieldOnlyPath(next) ? next : fallback;
  }
  // Office sessions must not be sent into the field portal via `next`.
  if (isFieldOnlyPath(next)) return fallback;
  return next;
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
      // Unified login is the primary entry — keep /field/login as BC redirect
      const unified = new URL("/login", request.url);
      const next = request.nextUrl.searchParams.get("next");
      if (next && isFieldOnlyPath(next)) {
        unified.searchParams.set("next", next);
      }
      return NextResponse.redirect(unified);
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
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

async function handleOfficeAuth(request: NextRequest, pathname: string) {
  const isApi = pathname.startsWith("/api/");

  if (isPublicOfficePath(pathname)) {
    if (pathname === "/login") {
      // Field session wins when present — never bounce to office routes.
      const fieldToken = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
      const fieldSession = await verifyFieldSession(fieldToken);
      if (fieldSession) {
        const next = request.nextUrl.searchParams.get("next");
        const dest = safeNextPath(next, "/field", "field");
        return NextResponse.redirect(new URL(dest, request.url));
      }

      const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
      const session = await verifyOfficeSession(token);
      if (session) {
        const next = request.nextUrl.searchParams.get("next");
        const portalHome = portalHomeForRole(session.role);
        const fallback = portalHome === "/login" ? "/dashboard" : portalHome;
        // Field managers who somehow hold an office cookie still belong in /field.
        if (fallback === "/field") {
          const dest = safeNextPath(next, "/field", "field");
          return NextResponse.redirect(new URL(dest, request.url));
        }
        const dest = safeNextPath(next, fallback, "office");
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
    if (pathname === "/manager" || pathname === "/manager/") {
      const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
      const session = await verifyOfficeSession(token);
      if (session) {
        const home = portalHomeForRole(session.role);
        return NextResponse.redirect(
          new URL(home === "/login" ? "/dashboard" : home, request.url)
        );
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
    const home = portalHomeForRole(session.role);
    return NextResponse.redirect(
      new URL(home === "/login" ? "/dashboard" : home, request.url)
    );
  }

  const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
  const session = await verifyOfficeSession(token);

  if (!session) {
    // Logged-in field managers hitting / or /dashboard must go to /field,
    // not /login?next=/dashboard (that created an infinite redirect loop).
    const fieldToken = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
    const fieldSession = await verifyFieldSession(fieldToken);
    if (fieldSession) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: "נדרשת התחברות למערכת מנהל הפרויקט" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/field", request.url));
    }

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

  // Office cookie present but role is field-only → send to field portal.
  const home = portalHomeForRole(session.role);
  if (home === "/field" && !isFieldOnlyPath(pathname)) {
    if (isApi) {
      return NextResponse.json(
        { success: false, error: "אין הרשאה למסך זה במערכת מנהל העבודה" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/field", request.url));
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
    // Legacy /worker/* namespace is not a live surface. It previously returned
    // NextResponse.next() with no auth check, which was an auth bypass. Route
    // it through the same auth funnel as the field portal:
    //   - with a valid field session → land on /field (keeping any subpath)
    //   - otherwise → send to unified /login with a `next` hint
    const token = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
    const session = await verifyFieldSession(token);
    const suffix = pathname.replace(/^\/worker/, "") || "";
    const target = `/field${suffix}`;
    if (session) {
      return NextResponse.redirect(new URL(target, request.url));
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", target);
    return NextResponse.redirect(login);
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
