import { prisma } from "@/lib/prisma";
import {
  canApproveDocuments,
  OPERATIONS_MANAGER_ROLE,
  roleGradeLabel,
} from "@/lib/auth/document-permissions";
import {
  ADMIN_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  PROJECT_MANAGER_ROLE,
  SYSTEM_MANAGER_ROLE,
} from "@/lib/auth/roles";

export type ApproverListItem = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  email: string | null;
  /** Why this person appears (for UI grouping) */
  group: "system" | "operations" | "project";
};

/**
 * Eligible document approvers for field/office submit pickers.
 * - System managers + Ops always
 * - Project managers only for the given project (owner or default approver), when projectId set
 */
export async function listDocumentApprovers(options?: {
  projectId?: string | null;
}): Promise<ApproverListItem[]> {
  const projectId = options?.projectId?.trim() || null;

  let projectPmIds = new Set<string>();
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        defaultApprovers: { select: { userId: true } },
      },
    });
    if (project) {
      projectPmIds.add(project.ownerId);
      for (const a of project.defaultApprovers) projectPmIds.add(a.userId);
    }
  }

  const users = await prisma.user.findMany({
    where: {
      passwordHash: { not: null },
      OR: [
        { role: SYSTEM_MANAGER_ROLE },
        { role: ADMIN_ROLE },
        { role: "admin" },
        { role: LEGACY_SYSTEM_ADMIN_ROLE },
        { role: "מנהל מערכת" },
        { role: OPERATIONS_MANAGER_ROLE },
        { role: PROJECT_MANAGER_ROLE },
      ],
    },
    select: { id: true, name: true, role: true, email: true },
    orderBy: { name: "asc" },
  });

  const items: ApproverListItem[] = [];

  for (const u of users) {
    if (!canApproveDocuments(u.role)) continue;

    const isSystem =
      u.role === SYSTEM_MANAGER_ROLE ||
      u.role === ADMIN_ROLE ||
      u.role === "admin" ||
      u.role === LEGACY_SYSTEM_ADMIN_ROLE ||
      u.role === "מנהל מערכת";
    const isOps = u.role === OPERATIONS_MANAGER_ROLE;
    const isPm = u.role === PROJECT_MANAGER_ROLE;

    if (isSystem) {
      items.push({
        id: u.id,
        name: u.name,
        role: u.role,
        roleLabel: roleGradeLabel(u.role),
        email: u.email,
        group: "system",
      });
      continue;
    }

    if (isOps) {
      items.push({
        id: u.id,
        name: u.name,
        role: u.role,
        roleLabel: roleGradeLabel(u.role),
        email: u.email,
        group: "operations",
      });
      continue;
    }

    if (isPm) {
      // Without project context: omit PMs (cannot verify project assignment).
      // With project: only that project's PM/default approvers.
      if (!projectId) continue;
      if (!projectPmIds.has(u.id)) continue;
      items.push({
        id: u.id,
        name: u.name,
        role: u.role,
        roleLabel: roleGradeLabel(u.role),
        email: u.email,
        group: "project",
      });
    }
  }

  // Deduplicate by id (user could match multiple buckets)
  const seen = new Set<string>();
  return items.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}
