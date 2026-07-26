import { OPERATIONS_MANAGER_ROLE } from "@/lib/auth/document-permissions";

type Approver = { id: string; role?: string | null; name?: string };

/**
 * Field docs should go primarily to Operations Manager —
 * not to every possible approver (AND multi-approve trap).
 */
export function pickDefaultApproverIds(items: Approver[]): string[] {
  const ops = items.filter((a) => a.role === OPERATIONS_MANAGER_ROLE);
  if (ops.length) return ops.map((a) => a.id);

  const admin = items.filter(
    (a) =>
      a.role === "ADMIN" ||
      a.role === "admin" ||
      a.role === "SYSTEM_MANAGER" ||
      a.role === "מנהל מערכת"
  );
  if (admin.length) return [admin[0]!.id];

  if (items[0]) return [items[0].id];
  return [];
}
