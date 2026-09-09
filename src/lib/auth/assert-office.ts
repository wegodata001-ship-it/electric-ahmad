import {
  OfficeAuthError,
  requireOfficeUser,
  type OfficeUserSession,
} from "@/lib/auth/office-session";
import {
  hasDocumentPermission,
  isSystemAdminRole,
  type DocumentPermission,
} from "@/lib/auth/document-permissions";
import {
  userCanAccessProject,
  type ProjectAccessScope,
} from "@/lib/auth/project-access";
import {
  ADMIN_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  SYSTEM_MANAGER_ROLE,
} from "@/lib/auth/roles";

/**
 * Thin wrappers around requireOfficeUser + permission matrix.
 *
 * NOTE: single-tenant, company-wide office ACL for now.
 * The Prisma schema does not model a `companyId` (multi-tenant) nor a
 * per-project office membership table, so any authenticated office user
 * is authorized to see all office scopes. Project membership is enforced
 * only for field-role callers via `requireFieldManager` / assertProjectSelectable.
 * When multi-tenancy or project-scoped office ACLs are introduced, tighten
 * these helpers instead of the individual route handlers.
 */
export async function requireOfficeAuth(): Promise<OfficeUserSession> {
  const session = await requireOfficeUser();
  const permittedRoles = new Set<string>([
    SYSTEM_MANAGER_ROLE,
    OPERATIONS_MANAGER_ROLE,
    PROJECT_MANAGER_ROLE,
    ADMIN_ROLE,
    LEGACY_SYSTEM_ADMIN_ROLE,
    "admin",
  ]);
  if (!permittedRoles.has(session.role)) {
    throw new OfficeAuthError("אין הרשאה לפורטל המשרדי", 403);
  }
  return session;
}

/**
 * Require an office session AND a specific document permission from the
 * role-permissions matrix in `document-permissions.ts`.
 * Throws OfficeAuthError(403) when the user lacks the permission — caller
 * lets `handleApiError` map it to a 403 response.
 */
export async function requirePermission(
  permission: DocumentPermission
): Promise<OfficeUserSession> {
  const session = await requireOfficeAuth();
  if (!hasDocumentPermission(session.role, permission)) {
    throw new OfficeAuthError("אין הרשאה לפעולה זו", 403);
  }
  return session;
}

/**
 * Require an office session with system-admin role (Ahmed / Fadi).
 * Used for provisioning logins, password resets, etc.
 */
export async function requireSystemAdmin(): Promise<OfficeUserSession> {
  const session = await requireOfficeAuth();
  if (!isSystemAdminRole(session.role)) {
    throw new OfficeAuthError("נדרשת הרשאת מנהל מערכת", 403);
  }
  return session;
}

/** User lifecycle and credential administration is canonical SYSTEM_MANAGER only. */
export async function requireUserManager(): Promise<OfficeUserSession> {
  const session = await requireOfficeAuth();
  if (session.role !== SYSTEM_MANAGER_ROLE) {
    throw new OfficeAuthError("ניהול משתמשים זמין למנהל מערכת בלבד", 403);
  }
  return session;
}

export async function requireProjectPermission(
  permission: DocumentPermission,
  projectId: string,
  scope: ProjectAccessScope = "manage"
): Promise<OfficeUserSession> {
  const session = await requirePermission(permission);
  const allowed = await userCanAccessProject({
    userId: session.userId,
    role: session.role,
    projectId,
    scope,
  });
  if (!allowed) {
    throw new OfficeAuthError("אין הרשאה לפרויקט זה", 403);
  }
  return session;
}
