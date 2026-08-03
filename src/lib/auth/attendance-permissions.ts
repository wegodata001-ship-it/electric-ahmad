import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { SECRETARY_ROLE } from "@/lib/auth/roles";

export { SECRETARY_ROLE };

export function isSecretaryRole(role?: string | null): boolean {
  return role === SECRETARY_ROLE || role === "מזכירה";
}

/** ניהול מסכי/דוחות נוכחות QR — מנהל מערכת או מזכירה בלבד */
export function canManageAttendance(role?: string | null): boolean {
  return isSystemAdminRole(role) || isSecretaryRole(role);
}
