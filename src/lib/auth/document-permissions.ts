import {
  ADMIN_ROLE,
  FIELD_MANAGER_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  PROJECT_MANAGER_ROLE,
  SYSTEM_MANAGER_ROLE,
  isFieldManagerRole,
  isOfficeRole,
} from "@/lib/auth/roles";

/** דרגה 1 — מנהלי מערכת (אחמד / פאדי) */
export const SYSTEM_ADMIN_ROLE = ADMIN_ROLE;
/** דרגה 2 — מנהל פרויקט / תפעול */
export const OPERATIONS_MANAGER_ROLE = "OPERATIONS_MANAGER" as const;

export type DocumentPermission =
  | "view_all"
  | "view_own"
  | "create"
  | "edit_draft"
  | "delete"
  | "approve"
  | "revoke_approval"
  | "unlock_signed"
  | "send_for_approval"
  | "send_to_client"
  | "view_history"
  | "view_audit"
  | "manage_numbering"
  | "manage_templates"
  | "manage_employees"
  | "manage_permissions"
  | "return_for_revision"
  | "add_comments"
  | "override_workflow";

const SYSTEM_ADMIN_PERMS: DocumentPermission[] = [
  "view_all",
  "view_own",
  "create",
  "edit_draft",
  "delete",
  "approve",
  "revoke_approval",
  "unlock_signed",
  "send_for_approval",
  "send_to_client",
  "view_history",
  "view_audit",
  "manage_numbering",
  "manage_templates",
  "manage_employees",
  "manage_permissions",
  "return_for_revision",
  "add_comments",
  "override_workflow",
];

/** Project / Ops — almost full office; send_to_client is System Admin only */
const PROJECT_OPS_PERMS: DocumentPermission[] = [
  "view_all",
  "view_own",
  "create",
  "edit_draft",
  "send_for_approval",
  "approve",
  "return_for_revision",
  "add_comments",
  "view_history",
];

const FIELD_PERMS: DocumentPermission[] = [
  "view_own",
  "create",
  "edit_draft",
  "send_for_approval",
];

export function isSystemAdminRole(role?: string | null): boolean {
  return (
    role === ADMIN_ROLE ||
    role === SYSTEM_MANAGER_ROLE ||
    role === "admin" ||
    role === LEGACY_SYSTEM_ADMIN_ROLE ||
    role === SYSTEM_ADMIN_ROLE
  );
}

export function isApproverRole(role?: string | null): boolean {
  return (
    isSystemAdminRole(role) ||
    role === PROJECT_MANAGER_ROLE ||
    role === OPERATIONS_MANAGER_ROLE
  );
}

export function canApproveDocuments(role?: string | null): boolean {
  return isApproverRole(role);
}

export function permissionsForRole(role?: string | null): DocumentPermission[] {
  if (isSystemAdminRole(role)) return SYSTEM_ADMIN_PERMS;
  if (role === PROJECT_MANAGER_ROLE || role === OPERATIONS_MANAGER_ROLE) {
    return PROJECT_OPS_PERMS;
  }
  if (isFieldManagerRole(role)) return FIELD_PERMS;
  if (isOfficeRole(role)) return PROJECT_OPS_PERMS;
  return [];
}

export function hasDocumentPermission(
  role: string | null | undefined,
  permission: DocumentPermission
): boolean {
  return permissionsForRole(role).includes(permission);
}

export function roleGradeLabel(role?: string | null): string {
  if (isSystemAdminRole(role)) return "מנהל מערכת";
  if (role === OPERATIONS_MANAGER_ROLE) return "מנהל תפעול";
  if (role === PROJECT_MANAGER_ROLE) return "מנהל פרויקט";
  if (role === FIELD_MANAGER_ROLE) return "מנהל עבודה";
  return role || "משתמש";
}
