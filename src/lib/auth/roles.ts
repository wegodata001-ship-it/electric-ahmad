export const FIELD_MANAGER_ROLE = "FIELD_MANAGER" as const;
export const PROJECT_MANAGER_ROLE = "PROJECT_MANAGER" as const;
export const OPERATIONS_MANAGER_ROLE = "OPERATIONS_MANAGER" as const;
export const ADMIN_ROLE = "ADMIN" as const;
/** דרגה 1 — System Manager (אחמד / פאדי) */
export const SYSTEM_MANAGER_ROLE = "SYSTEM_MANAGER" as const;
/** מזכירה — ניהול נוכחות QR */
export const SECRETARY_ROLE = "SECRETARY" as const;
/** נהג משאית / שליח — פורטל ביצוע תעודות משלוח בלבד */
export const TRUCK_DRIVER_ROLE = "TRUCK_DRIVER" as const;
/** Seed / legacy office admin role (Hebrew label kept for BC) */
export const LEGACY_SYSTEM_ADMIN_ROLE = "מנהל מערכת" as const;

/** Roles a System Manager may assign from User Management. */
export const MANAGED_USER_ROLES = [
  SYSTEM_MANAGER_ROLE,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  FIELD_MANAGER_ROLE,
  TRUCK_DRIVER_ROLE,
] as const;

export type ManagedUserRole = (typeof MANAGED_USER_ROLES)[number];

export function isManagedUserRole(role: unknown): role is ManagedUserRole {
  return MANAGED_USER_ROLES.includes(role as ManagedUserRole);
}

export function isFieldManagerRole(role?: string | null): boolean {
  return role === FIELD_MANAGER_ROLE;
}

/** Office / project-manager shell roles (not field) */
export function isOfficeRole(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === PROJECT_MANAGER_ROLE ||
    role === OPERATIONS_MANAGER_ROLE ||
    role === ADMIN_ROLE ||
    role === SYSTEM_MANAGER_ROLE ||
    role === SECRETARY_ROLE ||
    role === "מזכירה" ||
    role === TRUCK_DRIVER_ROLE ||
    role === "נהג" ||
    role === LEGACY_SYSTEM_ADMIN_ROLE ||
    role === "admin"
  );
}

export function officeRoleLabel(role?: string | null): string {
  if (role === PROJECT_MANAGER_ROLE) return "מנהל פרויקט";
  if (role === OPERATIONS_MANAGER_ROLE) return "מנהל תפעול";
  if (role === FIELD_MANAGER_ROLE) return "מנהל עבודה";
  if (role === SECRETARY_ROLE || role === "מזכירה") return "מזכירה";
  if (role === TRUCK_DRIVER_ROLE || role === "נהג") return "נהג משאית";
  if (
    role === ADMIN_ROLE ||
    role === SYSTEM_MANAGER_ROLE ||
    role === "admin"
  ) {
    return "מנהל מערכת";
  }
  if (role === LEGACY_SYSTEM_ADMIN_ROLE) return "מנהל מערכת";
  return role || "משתמש";
}
