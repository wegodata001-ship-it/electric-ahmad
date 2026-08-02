import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { OPERATIONS_MANAGER_ROLE } from "@/lib/auth/roles";

/**
 * שליחת חשבון / קישור פיננסי ללקוח או גורם חיצוני —
 * שמורה למנהל מערכת בלבד.
 */
export function canSendFinancialToClient(role?: string | null): boolean {
  return isSystemAdminRole(role);
}

export function isOperationsManagerRole(role?: string | null): boolean {
  return role === OPERATIONS_MANAGER_ROLE;
}

export const SEND_TO_CLIENT_FORBIDDEN_MESSAGE =
  "רק מנהל מערכת יכול לשלוח חשבון או קישור חיצוני ללקוח";
