import {
  isFieldManagerRole,
  isOfficeRole,
  isSubcontractorRole,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
} from "@/lib/auth/roles";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { isSecretaryRole } from "@/lib/auth/attendance-permissions";
import { isTruckDriverRole } from "@/lib/auth/driver-permissions";
import type { PortalId } from "@/lib/portals/config";
import { PORTALS, portalHomeForRole, portalIdForRole } from "@/lib/portals/config";

/**
 * Soft portal boundaries — each role's primary workspace.
 */
export function portalsAllowedForRole(role?: string | null): PortalId[] {
  if (isSystemAdminRole(role) || isSecretaryRole(role)) {
    return ["system"];
  }
  if (isTruckDriverRole(role)) return ["driver"];
  if (role === PROJECT_MANAGER_ROLE) return ["project"];
  if (role === OPERATIONS_MANAGER_ROLE) return ["operations"];
  if (isFieldManagerRole(role)) return ["field"];
  if (isSubcontractorRole(role)) return ["subcontractor"];
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
