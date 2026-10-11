import { isFieldManagerRole, isSubcontractorRole } from "@/lib/auth/roles";
import { portalHomeForRole } from "@/lib/portals/config";

export type SessionKind = "office" | "field" | "subcontractor";

export function isSafeInternalPath(path: string | null | undefined): boolean {
  return Boolean(
    path &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.startsWith("/api") &&
      !path.includes("\\")
  );
}

export function isAuthEntryPath(path: string): boolean {
  return (
    path === "/login" ||
    path === "/field/login" ||
    path === "/subcontractor/login" ||
    path === "/manager" ||
    path === "/manager/"
  );
}

export function isLegacyDashboardPath(path: string): boolean {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

export function sessionKindForRole(role?: string | null): SessionKind {
  if (isFieldManagerRole(role)) return "field";
  if (isSubcontractorRole(role)) return "subcontractor";
  return "office";
}

export function homePathForSession(kind: SessionKind, role?: string | null): string {
  if (kind === "field") return "/field";
  if (kind === "subcontractor") return "/subcontractor";
  const home = portalHomeForRole(role);
  return home === "/login" ? "/system" : home;
}

/** Role-scoped post-login destination. Rejects open redirects and cross-portal jumps. */
export function landingPathForSession(
  kind: SessionKind,
  role: string | undefined,
  next: string | null
): string {
  const fallback = homePathForSession(kind, role);
  if (!next || isLegacyDashboardPath(next) || isAuthEntryPath(next)) {
    return fallback;
  }
  if (!isSafeInternalPath(next)) return fallback;

  if (kind === "field") {
    return next.startsWith("/field") && !isAuthEntryPath(next) ? next : fallback;
  }
  if (kind === "subcontractor") {
    return next.startsWith("/subcontractor") &&
      !next.startsWith("/subcontractor/login") &&
      !next.startsWith("/subcontractor/activate")
      ? next
      : fallback;
  }
  if (next.startsWith("/field") || next.startsWith("/subcontractor")) {
    return fallback;
  }
  return next;
}

export function unifiedLoginHref(next?: string | null): string {
  if (next && isSafeInternalPath(next) && !isAuthEntryPath(next)) {
    return `/login?next=${encodeURIComponent(next)}`;
  }
  return "/login";
}
