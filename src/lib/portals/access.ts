import {
  isFieldManagerRole,
  isOfficeRole,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
} from "@/lib/auth/roles";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import type { PortalId } from "@/lib/portals/config";
import { PORTALS, portalIdForRole } from "@/lib/portals/config";

/**
 * Soft portal boundaries — each role's primary workspace.
 * System can enter all; others stay in their own portal.
 */
export function portalsAllowedForRole(role?: string | null): PortalId[] {
  if (isSystemAdminRole(role)) {
    return ["system", "project", "operations", "field"];
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
  const id = defaultPortalForRole(role);
  return id ? PORTALS[id].home : "/login";
}
