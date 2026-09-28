import { prisma } from "@/lib/prisma";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

export class ProjectManagerAssignmentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ProjectManagerAssignmentError";
  }
}

export class ProjectManagerAssignmentsRepository {
  static async list() {
    const [managers, projects] = await Promise.all([
      prisma.user.findMany({
        where: { role: PROJECT_MANAGER_ROLE },
        select: {
          id: true,
          name: true,
          username: true,
          status: true,
          ownedProjects: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          contractNumber: true,
          status: true,
          ownerId: true,
          owner: { select: { id: true, name: true, role: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      managers: managers.map((manager) => ({
        ...manager,
        projectIds: manager.ownedProjects.map((project) => project.id),
        ownedProjects: undefined,
      })),
      projects,
    };
  }

  static async replace(
    targetUserId: string,
    requestedProjectIds: string[],
    actorUserId: string
  ) {
    const projectIds = [...new Set(requestedProjectIds)];
    await prisma.$transaction(async (tx) => {
      const [target, actor, projects] = await Promise.all([
        tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, role: true, name: true },
        }),
        tx.user.findUnique({
          where: { id: actorUserId },
          select: { id: true },
        }),
        tx.project.findMany({
          where: { id: { in: projectIds }, deletedAt: null },
          select: { id: true, ownerId: true },
        }),
      ]);
      if (!target || target.role !== PROJECT_MANAGER_ROLE) {
        throw new ProjectManagerAssignmentError("מנהל הפרויקט לא נמצא", 404);
      }
      if (!actor) throw new ProjectManagerAssignmentError("המשתמש המבצע לא נמצא", 404);
      if (projects.length !== projectIds.length) {
        throw new ProjectManagerAssignmentError(
          "אחד הפרויקטים אינו קיים או הועבר לארכיון"
        );
      }

      const current = await tx.project.findMany({
        where: { ownerId: targetUserId, deletedAt: null },
        select: { id: true },
      });
      const currentIds = current.map((project) => project.id);
      const removed = currentIds.filter((id) => !projectIds.includes(id));
      const assigned = projects.filter(
        (project) => project.ownerId !== targetUserId
      );

      if (removed.length) {
        await tx.project.updateMany({
          where: { id: { in: removed }, ownerId: targetUserId },
          data: { ownerId: null, updatedById: actorUserId },
        });
      }
      if (projectIds.length) {
        await tx.project.updateMany({
          where: { id: { in: projectIds }, deletedAt: null },
          data: { ownerId: targetUserId, updatedById: actorUserId },
        });
      }

      const displacedOwnerIds = [
        ...new Set(
          assigned
            .map((project) => project.ownerId)
            .filter(
              (id): id is string =>
                Boolean(id) && id !== actorUserId && id !== targetUserId
            )
        ),
      ];
      const displacedManagers = displacedOwnerIds.length
        ? await tx.user.findMany({
            where: {
              id: { in: displacedOwnerIds },
              role: PROJECT_MANAGER_ROLE,
            },
            select: { id: true },
          })
        : [];
      const displacedManagerIds = new Set(
        displacedManagers.map((manager) => manager.id)
      );

      const auditRows = [
          ...removed.map((projectId) => ({
            action: "PROJECT_UNASSIGNED" as const,
            entityType: "Project",
            entityId: projectId,
            userId: actorUserId,
            metadata: JSON.stringify({
              projectId,
              projectManagerId: targetUserId,
            }),
          })),
          ...assigned
            .filter(
              (project) =>
                project.ownerId && displacedManagerIds.has(project.ownerId)
            )
            .map((project) => ({
              action: "PROJECT_UNASSIGNED" as const,
              entityType: "Project",
              entityId: project.id,
              userId: actorUserId,
              metadata: JSON.stringify({
                projectId: project.id,
                projectManagerId: project.ownerId,
                reassignedTo: targetUserId,
              }),
            })),
          ...assigned.map((project) => ({
            action: "PROJECT_ASSIGNED" as const,
            entityType: "Project",
            entityId: project.id,
            userId: actorUserId,
            metadata: JSON.stringify({
              projectId: project.id,
              projectManagerId: targetUserId,
            }),
          })),
        ];
      if (auditRows.length) {
        await tx.auditLog.createMany({ data: auditRows });
      }
    });
    return this.list();
  }
}
