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
  return requireOfficeUser();
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
