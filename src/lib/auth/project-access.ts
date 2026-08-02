import { prisma } from "@/lib/prisma";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import {
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
} from "@/lib/auth/roles";

/** מודולי ניהול פרויקט — רק פרויקטים שהוקצו ל-PM */
export type ProjectAccessScope = "manage" | "operational";

export function canSeeAllProjects(role?: string | null): boolean {
  return (
    isSystemAdminRole(role) || role === OPERATIONS_MANAGER_ROLE
  );
}

/**
 * manage = מדידות / חשבונות / BOQ / מסמכים / דוחות — רק פרויקטים בבעלות PM
 * operational = יומני עבודה / תעודות משלוח — כל הפרויקטים גם ל-PM
 */
export async function userCanAccessProject(opts: {
  userId: string;
  role: string;
  projectId: string;
  scope?: ProjectAccessScope;
}): Promise<boolean> {
  const scope = opts.scope ?? "manage";
  if (canSeeAllProjects(opts.role)) return true;

  if (opts.role === PROJECT_MANAGER_ROLE) {
    if (scope === "operational") {
      const exists = await prisma.project.findUnique({
        where: { id: opts.projectId },
        select: { id: true },
      });
      return Boolean(exists);
    }
    const owned = await prisma.project.findFirst({
      where: { id: opts.projectId, ownerId: opts.userId },
      select: { id: true },
    });
    return Boolean(owned);
  }

  return false;
}

export async function listProjectsForRole(opts: {
  userId: string;
  role: string;
  /** all = כל הפרויקטים (לתפעול); assigned = רק שהוקצו */
  mode?: "all" | "assigned";
}) {
  const mode = opts.mode ?? "assigned";
  if (canSeeAllProjects(opts.role) || mode === "all") {
    return prisma.project.findMany({
      select: {
        id: true,
        name: true,
        contractor: true,
        location: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (opts.role === PROJECT_MANAGER_ROLE) {
    return prisma.project.findMany({
      where: { ownerId: opts.userId },
      select: {
        id: true,
        name: true,
        contractor: true,
        location: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return [];
}
