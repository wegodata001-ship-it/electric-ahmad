import {
  isFieldManagerRole,
  isOfficeRole,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
} from "@/lib/auth/roles";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { isSecretaryRole } from "@/lib/auth/attendance-permissions";
import type { PortalId } from "@/lib/portals/config";
import { PORTALS, portalHomeForRole, portalIdForRole } from "@/lib/portals/config";

/**
 * Soft portal boundaries — each role's primary workspace.
 * SUPER ADMIN / System Manager → System Back Office only (full width).
 * Secretary → System portal (attendance management only).
 */
export function portalsAllowedForRole(role?: string | null): PortalId[] {
  if (isSystemAdminRole(role) || isSecretaryRole(role)) {
    return ["system"];
  }
  if (role === PROJECT_MANAGER_ROLE) return ["project"];
  if (role === OPERATIONS_MANAGER_ROLE) return ["operations"];
  if (isFieldManagerRole(role)) return ["field"];
  if (isOfficeRole(role)) return ["project"];
  return [];
}

export function canAccessPortal(
  role: string | null | undefined,
  portalId: PortalId
): boolean {
  return portalsAllowedForRole(role).includes(portalId);
}

export function defaultPortalForRole(role?: string | null): PortalId | null {
  return portalIdForRole(role);
}

export function portalHomeOrLogin(role?: string | null): string {
  const home = portalHomeForRole(role);
  return home === "/login" ? "/login" : home;
}
