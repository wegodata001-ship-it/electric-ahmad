import { prisma } from "@/lib/prisma";
import {
  hasDocumentPermission,
  type DocumentPermission,
} from "@/lib/auth/document-permissions";
import {
  canSeeAllProjects,
  userCanAccessProject,
} from "@/lib/auth/project-access";
import {
  OfficeAuthError,
  type OfficeUserSession,
} from "@/lib/auth/office-session";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

export type CrossProjectDocumentKind =
  | "WORK_DIARY"
  | "DELIVERY_NOTE"
  | "OPS_DELIVERY_NOTE";

export type OwnedProjectDocument = {
  id: string;
  projectId: string | null;
  createdById: string;
};

export async function assertCanCreateWdOrDnForProject(
  session: OfficeUserSession,
  projectId: string,
  kind: CrossProjectDocumentKind
) {
  if (!hasDocumentPermission(session.role, "create")) {
    throw new OfficeAuthError("אין הרשאה ליצירת מסמך", 403);
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, status: "active", deletedAt: null },
    select: { id: true, name: true, ownerId: true },
  });
  if (!project) {
    throw new OfficeAuthError("הפרויקט אינו פעיל או אינו קיים", 403);
  }

  const assigned =
    canSeeAllProjects(session.role) ||
    project.ownerId === session.userId;
  if (session.role !== PROJECT_MANAGER_ROLE && !assigned) {
    throw new OfficeAuthError("אין הרשאה לפרויקט זה", 403);
  }

  return {
    project,
    kind,
    assigned,
    crossProject:
      session.role === PROJECT_MANAGER_ROLE && !assigned,
  };
}

export async function assertCanAccessOwnedWdOrDn(
  session: OfficeUserSession,
  document: OwnedProjectDocument,
  permission: DocumentPermission
) {
  if (!hasDocumentPermission(session.role, permission)) {
    throw new OfficeAuthError("אין הרשאה לפעולה זו", 403);
  }
  if (canSeeAllProjects(session.role)) return;

  const assigned = document.projectId
    ? await userCanAccessProject({
        userId: session.userId,
        role: session.role,
        projectId: document.projectId,
      })
    : false;
  const ownsDocument =
    session.role === PROJECT_MANAGER_ROLE &&
    document.createdById === session.userId;

  if (!assigned && !ownsDocument) {
    throw new OfficeAuthError("אין הרשאה למסמך זה", 403);
  }
}

export async function listWdDnCreationProjects(
  session: OfficeUserSession
) {
  if (!hasDocumentPermission(session.role, "create")) {
    throw new OfficeAuthError("אין הרשאה ליצירת מסמך", 403);
  }
  const projects = await prisma.project.findMany({
    where: { status: "active", deletedAt: null },
    select: {
      id: true,
      name: true,
      contractNumber: true,
      contractor: true,
      location: true,
      ownerId: true,
    },
    orderBy: [{ ownerId: "asc" }, { name: "asc" }],
  });
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    contractNumber: project.contractNumber,
    contractor: project.contractor,
    location: project.location,
    assigned:
      canSeeAllProjects(session.role) ||
      project.ownerId === session.userId,
  }));
}
