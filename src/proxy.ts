import { NextResponse, type NextRequest } from "next/server";
import {
  FIELD_SESSION_COOKIE,
  verifyFieldSession,
} from "@/lib/auth/field-cookie";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
} from "@/lib/auth/office-cookie";
import {
  SUBCONTRACTOR_SESSION_COOKIE,
  verifySubcontractorSession,
} from "@/lib/auth/subcontractor-cookie";
import { portalHomeForRole } from "@/lib/portals/config";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { isSecretaryRole } from "@/lib/auth/attendance-permissions";
import { isTruckDriverRole } from "@/lib/auth/driver-permissions";
import {
  isLegacyDashboardPath,
  landingPathForSession,
  unifiedLoginHref,
} from "@/lib/auth/login-redirect";

function isPublicFieldPath(pathname: string): boolean {
  return (
    pathname === "/field/login" ||
    pathname === "/api/field/auth/login" ||
    pathname === "/api/field/auth/logout"
  );
}

function isPublicSubcontractorPath(pathname: string): boolean {
  return (
    pathname === "/subcontractor/login" ||
    pathname === "/subcontractor/activate" ||
    pathname.startsWith("/subcontractor/activate/") ||
    pathname === "/api/subcontractor/auth/activate"
  );
}

function isSubcontractorPath(pathname: string): boolean {
  return (
    pathname === "/subcontractor" ||
    pathname.startsWith("/subcontractor/") ||
    pathname === "/api/subcontractor" ||
    pathname.startsWith("/api/subcontractor/")
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
    pathname === "/api/system/perf/rtt" ||
    pathname === "/api/system/perf/workflow-bench" ||
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/api/sign/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/api/external-share/public/")
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

function officeLandingPath(role: string | undefined, next: string | null): string {
  return landingPathForSession("office", role, next);
}

function fieldLandingPath(next: string | null): string {
  return landingPathForSession("field", undefined, next);
}

function subcontractorLandingPath(next: string | null): string {
  return landingPathForSession("subcontractor", undefined, next);
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
      if (next) unified.searchParams.set("next", next);
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
    const login = new URL(unifiedLoginHref(pathname), request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

async function handleOfficeAuth(request: NextRequest, pathname: string) {
  const isApi = pathname.startsWith("/api/");

  if (isPublicOfficePath(pathname)) {
    if (pathname === "/login") {
      const next = request.nextUrl.searchParams.get("next");
      const fieldToken = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
      const fieldSession = await verifyFieldSession(fieldToken);
      if (fieldSession) {
        return NextResponse.redirect(
          new URL(fieldLandingPath(next), request.url)
        );
      }

      const subToken = request.cookies.get(SUBCONTRACTOR_SESSION_COOKIE)?.value;
      const subSession = await verifySubcontractorSession(subToken);
      if (subSession) {
        return NextResponse.redirect(
          new URL(subcontractorLandingPath(next), request.url)
        );
      }

      const token = request.cookies.get(OFFICE_SESSION_COOKIE)?.value;
      const session = await verifyOfficeSession(token);
      if (session) {
        return NextResponse.redirect(
          new URL(officeLandingPath(session.role, next), request.url)
        );
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

  // Field managers may reach measurement-sheet approval APIs (handler
  // enforces role + assignment). Without this, proxy returns office 401
  // before the field fallback in /api/approvals/* can run.
  if (
    pathname === "/api/approvals/pending" ||
    pathname === "/api/approvals/review"
  ) {
    const fieldToken = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
    const fieldSession = await verifyFieldSession(fieldToken);
    if (fieldSession) {
      return NextResponse.next();
    }
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
    // Prefer field home over /login?next=/dashboard when only a field
    // session exists — avoids redirect ping-pong with the login handler.
    if (isLegacyDashboardPath(pathname)) {
      const fieldToken = request.cookies.get(FIELD_SESSION_COOKIE)?.value;
      const fieldSession = await verifyFieldSession(fieldToken);
      if (fieldSession) {
        return NextResponse.redirect(new URL("/field", request.url));
      }
      // No next=/dashboard — that looped with field sessions on /login.
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Office users hitting legacy /dashboard → role portal (sysmgr → /system).
  if (isLegacyDashboardPath(pathname)) {
    const dest = officeLandingPath(session.role, null);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // SUPER ADMIN must stay on full-width /system — never Project/Ops portal UI.
  if (isSystemAdminRole(session.role)) {
    if (
      pathname === "/project" ||
      pathname.startsWith("/project/") ||
      pathname === "/operations" ||
      pathname.startsWith("/operations/")
    ) {
      return NextResponse.redirect(new URL("/system/accounts", request.url));
    }
  }

  // Secretary — QR admin screen was removed; preserve check-in and APIs only.
  if (isSecretaryRole(session.role)) {
    const allowedSystem =
      pathname.startsWith("/api/attendance/") ||
      pathname.startsWith("/api/auth/") ||
      pathname === "/attendance/checkin" ||
      pathname.startsWith("/attendance/checkin");
    if (pathname.startsWith("/system/")) {
      return NextResponse.redirect(new URL("/attendance/checkin", request.url));
    }
    if (isApi && !allowedSystem) {
      return NextResponse.json(
        { success: false, error: "אין הרשאה ל־API זה" },
        { status: 403 }
      );
    }
    if (
      !allowedSystem &&
      (pathname.startsWith("/project") ||
        pathname.startsWith("/operations") ||
        pathname.startsWith("/dashboard"))
    ) {
      return NextResponse.redirect(new URL("/attendance/checkin", request.url));
    }
  }

  // Truck driver — execution portal only
  if (isTruckDriverRole(session.role)) {
    const onDriver =
      pathname === "/driver" ||
      pathname.startsWith("/driver/") ||
      pathname.startsWith("/api/driver/") ||
      pathname.startsWith("/api/auth/");
    if (isApi && !onDriver) {
      return NextResponse.json(
        { success: false, error: "אין הרשאה ל־API זה" },
        { status: 403 }
      );
    }
    if (!onDriver) {
      if (
        pathname.startsWith("/project") ||
        pathname.startsWith("/operations") ||
        pathname.startsWith("/system") ||
        pathname.startsWith("/field") ||
        pathname.startsWith("/dashboard")
      ) {
        return NextResponse.redirect(new URL("/driver", request.url));
      }
    }
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

  // Work-diary print uses the same protected document for both office and
  // field users. The page itself performs project/foreman authorization.
  if (pathname.startsWith("/print/work-diaries/")) {
    const officeSession = await verifyOfficeSession(
      request.cookies.get(OFFICE_SESSION_COOKIE)?.value
    );
    if (officeSession) return NextResponse.next();
    const fieldSession = await verifyFieldSession(
      request.cookies.get(FIELD_SESSION_COOKIE)?.value
    );
    if (fieldSession) return NextResponse.next();
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isSubcontractorPath(pathname)) {
    const token = request.cookies.get(SUBCONTRACTOR_SESSION_COOKIE)?.value;
    const session = await verifySubcontractorSession(token);
    if (pathname === "/subcontractor/login") {
      if (session) {
        return NextResponse.redirect(new URL("/subcontractor", request.url));
      }
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(new URL(unifiedLoginHref(next), request.url));
    }
    if (isPublicSubcontractorPath(pathname)) {
      return NextResponse.next();
    }
    const isApi =
      pathname === "/api/subcontractor" ||
      pathname.startsWith("/api/subcontractor/");
    if (!session) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: "נדרשת התחברות לפורטל קבלן המשנה" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(
        new URL(unifiedLoginHref(pathname), request.url)
      );
    }
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
