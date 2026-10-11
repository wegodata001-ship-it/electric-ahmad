import { OfficeAuthError, type OfficeUserSession } from "@/lib/auth/office-session";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import {
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  FIELD_MANAGER_ROLE,
} from "@/lib/auth/roles";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { prisma } from "@/lib/prisma";

export type SubcontractorOfficeAction =
  | "manage_registry"
  | "manage_users"
  | "manage_assignments"
  | "manage_rates"
  | "review_measurements"
  | "approve_accounts"
  | "record_payments"
  | "view_ledger"
  | "view_bank";

export function canManageSubcontractorRegistry(role?: string | null): boolean {
  return isSystemAdminRole(role) || role === OPERATIONS_MANAGER_ROLE;
}

export function canManageSubcontractorUsers(role?: string | null): boolean {
  return isSystemAdminRole(role);
}

export function canApproveSubcontractorFinance(role?: string | null): boolean {
  return isSystemAdminRole(role);
}

export function canReviewSubcontractorWork(role?: string | null): boolean {
  return (
    isSystemAdminRole(role) ||
    role === OPERATIONS_MANAGER_ROLE ||
    role === PROJECT_MANAGER_ROLE
  );
}

export function canViewBankDetails(role?: string | null): boolean {
  return isSystemAdminRole(role);
}

export async function requireSubcontractorOfficeAction(
  action: SubcontractorOfficeAction
): Promise<OfficeUserSession> {
  const session = await requireOfficeAuth();
  if (action === "manage_users" && !canManageSubcontractorUsers(session.role)) {
    throw new OfficeAuthError("רק מנהל מערכת יכול לנהל משתמשי קבלן", 403);
  }
  if (action === "approve_accounts" && !canApproveSubcontractorFinance(session.role)) {
    throw new OfficeAuthError("אין הרשאה לאישור חשבונות קבלן", 403);
  }
  if (action === "record_payments" && !canApproveSubcontractorFinance(session.role)) {
    throw new OfficeAuthError("אין הרשאה לרישום תשלומים", 403);
  }
  if (action === "view_bank" && !canViewBankDetails(session.role)) {
    throw new OfficeAuthError("אין הרשאה לפרטי חשבון בנק", 403);
  }
  if (action === "manage_registry" && !canManageSubcontractorRegistry(session.role)) {
    throw new OfficeAuthError("אין הרשאה לניהול מאגר קבלנים", 403);
  }
  if (
    (action === "manage_assignments" ||
      action === "manage_rates" ||
      action === "review_measurements" ||
      action === "view_ledger") &&
    !canReviewSubcontractorWork(session.role)
  ) {
    throw new OfficeAuthError("אין הרשאה לפעולה זו", 403);
  }
  return session;
}

export async function assertOfficeCanAccessProject(
  session: OfficeUserSession,
  projectId: string
): Promise<void> {
  if (session.role === FIELD_MANAGER_ROLE) {
    throw new OfficeAuthError("אין הרשאה משרדית לפרויקט", 403);
  }
  const allowed = await userCanAccessProject({
    userId: session.userId,
    role: session.role,
    projectId,
    scope: "operational",
  });
  if (!allowed) {
    throw new OfficeAuthError("אין הרשאה לפרויקט זה", 403);
  }
}

export async function assertOfficeCanAccessSubcontractor(
  session: OfficeUserSession,
  subcontractorId: string
): Promise<void> {
  if (isSystemAdminRole(session.role) || session.role === OPERATIONS_MANAGER_ROLE) {
    return;
  }
  if (session.role !== PROJECT_MANAGER_ROLE) {
    throw new OfficeAuthError("אין הרשאה לקבלן משנה זה", 403);
  }
  const linked = await prisma.subcontractorAssignment.findFirst({
    where: {
      subcontractorId,
      status: { not: "cancelled" },
      project: { ownerId: session.userId, deletedAt: null },
    },
    select: { id: true },
  });
  if (!linked) {
    throw new OfficeAuthError("אין הרשאה לקבלן משנה זה", 403);
  }
}
