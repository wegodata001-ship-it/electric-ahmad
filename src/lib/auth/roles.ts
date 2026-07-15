export const FIELD_MANAGER_ROLE = "FIELD_MANAGER" as const;
export const PROJECT_MANAGER_ROLE = "PROJECT_MANAGER" as const;
export const ADMIN_ROLE = "ADMIN" as const;
/** Seed / legacy office admin role (Hebrew label kept for BC) */
export const LEGACY_SYSTEM_ADMIN_ROLE = "מנהל מערכת" as const;

export function isFieldManagerRole(role?: string | null): boolean {
  return role === FIELD_MANAGER_ROLE;
}

/** Office / project-manager shell roles (not field) */
export function isOfficeRole(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === PROJECT_MANAGER_ROLE ||
    role === ADMIN_ROLE ||
    role === LEGACY_SYSTEM_ADMIN_ROLE ||
    role === "admin"
  );
}

export function officeRoleLabel(role?: string | null): string {
  if (role === PROJECT_MANAGER_ROLE) return "מנהל פרויקט";
  if (role === ADMIN_ROLE || role === "admin") return "מנהל מערכת";
  if (role === LEGACY_SYSTEM_ADMIN_ROLE) return "מנהל מערכת";
  return role || "משתמש";
}
