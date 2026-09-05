import {
  ADMIN_ROLE,
  FIELD_MANAGER_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  SYSTEM_MANAGER_ROLE,
  TRUCK_DRIVER_ROLE,
} from "@/lib/auth/roles";

export function isTruckDriverRole(role?: string | null): boolean {
  return role === TRUCK_DRIVER_ROLE || role === "נהג";
}

/** Who may approve driver delivery notes (any one is enough) */
export function canApproveDriverDeliveryNote(role?: string | null): boolean {
  return (
    role === ADMIN_ROLE ||
    role === SYSTEM_MANAGER_ROLE ||
    role === "admin" ||
    role === LEGACY_SYSTEM_ADMIN_ROLE ||
    role === OPERATIONS_MANAGER_ROLE
  );
}

export { PROJECT_MANAGER_ROLE, FIELD_MANAGER_ROLE };
