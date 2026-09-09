import { Prisma, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  FIELD_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  type ManagedUserRole,
} from "@/lib/auth/roles";

export class SystemUserError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "SystemUserError";
  }
}

export type SystemUserInput = {
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: ManagedUserRole;
  projectIds?: string[];
  allowNoProjects?: boolean;
};

export type CreateSystemUserInput = SystemUserInput & {
  password: string;
};

const userInclude = {
  employee: {
    include: {
      projectLinks: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              contractNumber: true,
              deletedAt: true,
            },
          },
        },
      },
      foremanProjects: {
        where: { deletedAt: null },
        select: { id: true, name: true, contractNumber: true },
      },
      _count: { select: { fieldAttendances: true } },
    },
  },
  ownedProjects: {
    where: { deletedAt: null },
    select: { id: true, name: true, contractNumber: true },
  },
  auditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 8,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      createdDocuments: true,
      updatedDocuments: true,
      createdWorkDiaries: true,
      updatedWorkDiaries: true,
      createdOpsDeliveryNotes: true,
      updatedOpsDeliveryNotes: true,
      createdApprovals: true,
      assignedInvoiceApprovals: true,
      workDiaryApprovals: true,
      opsDnApprovals: true,
      measurementSheetApprovals: true,
      workflowApprovals: true,
      auditLogs: true,
      ownedProjects: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAdminRelations = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

function normalizeInput(input: SystemUserInput) {
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  const email =
    input.email?.trim().toLowerCase() ||
    `${username}@users.wego-electric.local`;
  const phone = input.phone?.trim() || null;
  const projectIds = [...new Set(input.projectIds ?? [])];

  if (name.length < 2) throw new SystemUserError("יש להזין שם מלא");
  if (username.length < 3) {
    throw new SystemUserError("שם משתמש חייב להכיל לפחות 3 תווים");
  }
  if (!email.includes("@")) throw new SystemUserError("כתובת אימייל אינה תקינה");
  if (input.role === FIELD_MANAGER_ROLE && !phone) {
    throw new SystemUserError("טלפון הוא שדה חובה למנהל עבודה");
  }
  if (
    (input.role === PROJECT_MANAGER_ROLE ||
      input.role === FIELD_MANAGER_ROLE) &&
    projectIds.length === 0 &&
    !input.allowNoProjects
  ) {
    throw new SystemUserError(
      input.role === PROJECT_MANAGER_ROLE
        ? "יש לבחור לפחות פרויקט אחד או לאשר שמירה ללא שיוך"
        : "יש לבחור לפחות אתר עבודה אחד"
    );
  }
  return { name, username, email, phone, projectIds };
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.shift() || name,
    lastName: parts.join(" ") || "-",
  };
}

async function assertUniqueIdentifiers(
  tx: Prisma.TransactionClient,
  username: string,
  email: string,
  excludeId?: string
) {
  const duplicate = await tx.user.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        { username: { equals: username, mode: "insensitive" } },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
    select: { username: true, email: true },
  });
  if (!duplicate) return;
  if (duplicate.username?.toLowerCase() === username) {
    throw new SystemUserError("שם המשתמש כבר קיים");
  }
  throw new SystemUserError("כתובת האימייל כבר קיימת");
}

async function assertProjects(
  tx: Prisma.TransactionClient,
  projectIds: string[]
) {
  if (!projectIds.length) return;
  const count = await tx.project.count({
    where: { id: { in: projectIds }, deletedAt: null },
  });
  if (count !== projectIds.length) {
    throw new SystemUserError("אחד הפרויקטים שנבחרו אינו קיים או הועבר לארכיון");
  }
}

async function assertUniqueEmployeeContact(
  tx: Prisma.TransactionClient,
  email: string,
  phone: string | null,
  excludeEmployeeId?: string
) {
  const duplicate = await tx.employee.findFirst({
    where: {
      id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined,
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: { email: true, phone: true },
  });
  if (!duplicate) return;
  throw new SystemUserError(
    duplicate.email.toLowerCase() === email
      ? "האימייל כבר משויך לעובד"
      : "מספר הטלפון כבר משויך לעובד"
  );
}

function formatUser(user: UserWithAdminRelations) {
  const linkedProjects = user.employee?.projectLinks
    .filter(({ project }) => !project.deletedAt)
    .map(({ project }) => ({
      id: project.id,
      name: project.name,
      contractNumber: project.contractNumber,
      assignmentType: "member" as const,
    })) ?? [];
  const foremanProjects = user.employee?.foremanProjects.map((project) => ({
    ...project,
    assignmentType: "foreman" as const,
  })) ?? [];
  const ownedProjects = user.ownedProjects.map((project) => ({
    ...project,
    assignmentType: "owner" as const,
  }));
  const projects = [
    ...new Map(
      [...ownedProjects, ...foremanProjects, ...linkedProjects].map((project) => [
        project.id,
        project,
      ])
    ).values(),
  ];
  const businessReferenceCount =
    user._count.createdDocuments +
    user._count.updatedDocuments +
    user._count.createdWorkDiaries +
    user._count.updatedWorkDiaries +
    user._count.createdOpsDeliveryNotes +
    user._count.updatedOpsDeliveryNotes +
    user._count.createdApprovals +
    user._count.assignedInvoiceApprovals +
    user._count.workDiaryApprovals +
    user._count.opsDnApprovals +
    user._count.measurementSheetApprovals +
    user._count.workflowApprovals +
    user._count.auditLogs +
    (user.employee?._count.fieldAttendances ?? 0) +
    user._count.ownedProjects;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone ?? user.employee?.phone ?? null,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    archivedAt: user.archivedAt?.toISOString() ?? null,
    employee: user.employee
      ? {
          id: user.employee.id,
          role: user.employee.role,
          status: user.employee.status,
          isDeleted: user.employee.isDeleted,
        }
      : null,
    projects,
    businessReferenceCount,
    recentActions: user.auditLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export class SystemUsersRepository {
  static async list() {
    const users = await prisma.user.findMany({
      include: userInclude,
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return users.map(formatUser);
  }

  static async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    return user ? formatUser(user) : null;
  }

  static async create(input: CreateSystemUserInput, actorUserId: string) {
    const normalized = normalizeInput(input);
    if (input.password.length < 8) {
      throw new SystemUserError("סיסמה זמנית חייבת להכיל לפחות 8 תווים");
    }
    const passwordHash = await hashPassword(input.password);

    const userId = await prisma.$transaction(async (tx) => {
      await assertUniqueIdentifiers(
        tx,
        normalized.username,
        normalized.email
      );
      await assertProjects(tx, normalized.projectIds);
      const priorProjectOwners =
        input.role === PROJECT_MANAGER_ROLE && normalized.projectIds.length
          ? await tx.project.findMany({
              where: { id: { in: normalized.projectIds }, deletedAt: null },
              select: {
                id: true,
                ownerId: true,
                owner: { select: { role: true } },
              },
            })
          : [];
      if (input.role === FIELD_MANAGER_ROLE) {
        await assertUniqueEmployeeContact(
          tx,
          normalized.email,
          normalized.phone
        );
      }

      const user = await tx.user.create({
        data: {
          name: normalized.name,
          username: normalized.username,
          email: normalized.email,
          phone: normalized.phone,
          passwordHash,
          role: input.role,
          status: "ACTIVE",
        },
      });

      if (input.role === FIELD_MANAGER_ROLE) {
        const names = splitName(normalized.name);
        const employee = await tx.employee.create({
          data: {
            ...names,
            phone: normalized.phone!,
            email: normalized.email,
            role: "foreman",
            status: "active",
            joinedAt: new Date(),
            userId: user.id,
          },
        });
        if (normalized.projectIds.length) {
          await tx.projectEmployee.createMany({
            data: normalized.projectIds.map((projectId) => ({
              projectId,
              employeeId: employee.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (input.role === PROJECT_MANAGER_ROLE && normalized.projectIds.length) {
        await tx.project.updateMany({
          where: { id: { in: normalized.projectIds }, deletedAt: null },
          data: { ownerId: user.id, updatedById: actorUserId },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "USER_CREATED",
          entityType: "User",
          entityId: user.id,
          userId: actorUserId,
          metadata: JSON.stringify({
            targetUserId: user.id,
            role: input.role,
            status: "ACTIVE",
            projectIds: normalized.projectIds,
          }),
        },
      });
      if (normalized.projectIds.length) {
        await tx.auditLog.create({
          data: {
            action: "PROJECT_ASSIGNMENT_CHANGED",
            entityType: "User",
            entityId: user.id,
            userId: actorUserId,
            metadata: JSON.stringify({
              targetUserId: user.id,
              oldValue: [],
              newValue: normalized.projectIds,
            }),
          },
        });
        if (input.role === PROJECT_MANAGER_ROLE) {
          await tx.auditLog.createMany({
            data: [
              ...priorProjectOwners
                .filter(
                  (project) =>
                    project.owner.role === PROJECT_MANAGER_ROLE &&
                    project.ownerId !== user.id
                )
                .map((project) => ({
                  action: "PROJECT_UNASSIGNED" as const,
                  entityType: "Project",
                  entityId: project.id,
                  userId: actorUserId,
                  metadata: JSON.stringify({
                    projectId: project.id,
                    projectManagerId: project.ownerId,
                    reassignedTo: user.id,
                  }),
                })),
              ...normalized.projectIds.map((projectId) => ({
                action: "PROJECT_ASSIGNED" as const,
                entityType: "Project",
                entityId: projectId,
                userId: actorUserId,
                metadata: JSON.stringify({
                  projectId,
                  projectManagerId: user.id,
                }),
              })),
            ],
          });
        }
      }
      return user.id;
    });

    return this.getById(userId);
  }

  static async update(
    id: string,
    input: SystemUserInput,
    actorUserId: string
  ) {
    const normalized = normalizeInput(input);
    if (id === actorUserId && input.role !== "SYSTEM_MANAGER") {
      throw new SystemUserError("לא ניתן להסיר מעצמך הרשאת מנהל מערכת");
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id },
        include: {
          employee: true,
          ownedProjects: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });
      if (!existing) throw new SystemUserError("משתמש לא נמצא", 404);
      await assertUniqueIdentifiers(
        tx,
        normalized.username,
        normalized.email,
        id
      );
      await assertProjects(tx, normalized.projectIds);
      const selectedProjectOwners =
        input.role === PROJECT_MANAGER_ROLE && normalized.projectIds.length
          ? await tx.project.findMany({
              where: { id: { in: normalized.projectIds }, deletedAt: null },
              select: {
                id: true,
                ownerId: true,
                owner: { select: { role: true } },
              },
            })
          : [];
      if (input.role === FIELD_MANAGER_ROLE || existing.employee) {
        await assertUniqueEmployeeContact(
          tx,
          normalized.email,
          normalized.phone,
          existing.employee?.id
        );
      }

      let employeeId = existing.employee?.id ?? null;
      if (input.role === FIELD_MANAGER_ROLE && !existing.employee) {
        const names = splitName(normalized.name);
        const employee = await tx.employee.create({
          data: {
            ...names,
            phone: normalized.phone!,
            email: normalized.email,
            role: "foreman",
            status: "active",
            joinedAt: new Date(),
            userId: id,
          },
        });
        employeeId = employee.id;
      } else if (existing.employee) {
        const names = splitName(normalized.name);
        await tx.employee.update({
          where: { id: existing.employee.id },
          data: {
            ...names,
            phone: normalized.phone ?? existing.employee.phone,
            email: normalized.email,
          },
        });
      }

      await tx.user.update({
        where: { id },
        data: {
          name: normalized.name,
          username: normalized.username,
          email: normalized.email,
          phone: normalized.phone,
          role: input.role,
        },
      });

      const oldProjectIds =
        input.role === PROJECT_MANAGER_ROLE
          ? existing.ownedProjects.map((project) => project.id)
          : existing.employee
            ? (
                await tx.projectEmployee.findMany({
                  where: { employeeId: existing.employee.id },
                  select: { projectId: true },
                })
              ).map(({ projectId }) => projectId)
            : [];
      const removedProjectIds = oldProjectIds.filter(
        (projectId) => !normalized.projectIds.includes(projectId)
      );
      const addedProjectIds = normalized.projectIds.filter(
        (projectId) => !oldProjectIds.includes(projectId)
      );

      if (input.role === PROJECT_MANAGER_ROLE) {
        if (removedProjectIds.length) {
          await tx.project.updateMany({
            where: {
              id: { in: removedProjectIds },
              ownerId: id,
              deletedAt: null,
            },
            data: { ownerId: actorUserId, updatedById: actorUserId },
          });
        }
        if (normalized.projectIds.length) {
          await tx.project.updateMany({
            where: { id: { in: normalized.projectIds }, deletedAt: null },
            data: { ownerId: id, updatedById: actorUserId },
          });
        }
      } else if (input.role === FIELD_MANAGER_ROLE && employeeId) {
        await tx.projectEmployee.deleteMany({
          where: {
            employeeId,
            projectId: { notIn: normalized.projectIds },
          },
        });
        if (normalized.projectIds.length) {
          await tx.projectEmployee.createMany({
            data: normalized.projectIds.map((projectId) => ({
              projectId,
              employeeId: employeeId!,
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "USER_UPDATED",
          entityType: "User",
          entityId: id,
          userId: actorUserId,
          metadata: JSON.stringify({
            targetUserId: id,
            oldValue: {
              name: existing.name,
              username: existing.username,
              email: existing.email,
              phone: existing.phone,
              role: existing.role,
            },
            newValue: {
              name: normalized.name,
              username: normalized.username,
              email: normalized.email,
              phone: normalized.phone,
              role: input.role,
            },
          }),
        },
      });

      if (existing.role !== input.role) {
        await tx.auditLog.create({
          data: {
            action: "ROLE_CHANGED",
            entityType: "User",
            entityId: id,
            userId: actorUserId,
            metadata: JSON.stringify({
              targetUserId: id,
              oldValue: existing.role,
              newValue: input.role,
            }),
          },
        });
      }
      if (
        [...oldProjectIds].sort().join(",") !==
        [...normalized.projectIds].sort().join(",")
      ) {
        await tx.auditLog.create({
          data: {
            action: "PROJECT_ASSIGNMENT_CHANGED",
            entityType: "User",
            entityId: id,
            userId: actorUserId,
            metadata: JSON.stringify({
              targetUserId: id,
              oldValue: oldProjectIds,
              newValue: normalized.projectIds,
            }),
          },
        });
        if (input.role === PROJECT_MANAGER_ROLE) {
          const assignmentAuditRows = [
            ...removedProjectIds.map((projectId) => ({
              action: "PROJECT_UNASSIGNED" as const,
              entityType: "Project",
              entityId: projectId,
              userId: actorUserId,
              metadata: JSON.stringify({
                projectId,
                projectManagerId: id,
              }),
            })),
            ...selectedProjectOwners
              .filter(
                (project) =>
                  addedProjectIds.includes(project.id) &&
                  project.owner.role === PROJECT_MANAGER_ROLE &&
                  project.ownerId !== id
              )
              .map((project) => ({
                action: "PROJECT_UNASSIGNED" as const,
                entityType: "Project",
                entityId: project.id,
                userId: actorUserId,
                metadata: JSON.stringify({
                  projectId: project.id,
                  projectManagerId: project.ownerId,
                  reassignedTo: id,
                }),
              })),
            ...addedProjectIds.map((projectId) => ({
              action: "PROJECT_ASSIGNED" as const,
              entityType: "Project",
              entityId: projectId,
              userId: actorUserId,
              metadata: JSON.stringify({
                projectId,
                projectManagerId: id,
              }),
            })),
          ];
          if (assignmentAuditRows.length) {
            await tx.auditLog.createMany({ data: assignmentAuditRows });
          }
        }
      }
    });
    return this.getById(id);
  }

  static async setStatus(
    id: string,
    status: UserStatus,
    actorUserId: string
  ) {
    if (id === actorUserId && status !== "ACTIVE") {
      throw new SystemUserError("לא ניתן להשבית או לארכב את המשתמש שלך");
    }
    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        employee: { select: { status: true, isDeleted: true } },
      },
    });
    if (!existing) throw new SystemUserError("משתמש לא נמצא", 404);
    if (
      status === "ACTIVE" &&
      existing.employee &&
      (existing.employee.isDeleted || existing.employee.status !== "active")
    ) {
      throw new SystemUserError(
        "לא ניתן להפעיל משתמש שהעובד המקושר שלו אינו פעיל"
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          status,
          archivedAt: status === "ARCHIVED" ? new Date() : null,
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.auditLog.create({
        data: {
          action:
            status === "ACTIVE" ? "USER_REACTIVATED" : "USER_DISABLED",
          entityType: "User",
          entityId: id,
          userId: actorUserId,
          metadata: JSON.stringify({
            targetUserId: id,
            oldValue: existing.status,
            newValue: status,
          }),
        },
      }),
    ]);
    return this.getById(id);
  }

  static async deletePermanently(id: string, actorUserId: string) {
    if (id === actorUserId) {
      throw new SystemUserError("לא ניתן למחוק לצמיתות את המשתמש שלך");
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        employee: { select: { id: true } },
      },
    });
    if (!existing) throw new SystemUserError("משתמש לא נמצא", 404);
    if (existing.status !== "ARCHIVED") {
      throw new SystemUserError(
        "מטעמי בטיחות, יש להעביר את המשתמש לארכיון לפני מחיקה לצמיתות"
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (existing.employee) {
          await tx.employee.update({
            where: { id: existing.employee.id },
            data: { userId: null, wantsSystemUser: false },
          });
        }

        // Logs performed by the deleted identity cannot retain their required FK.
        // The deletion itself is preserved as a separate audit event by the actor.
        await tx.auditLog.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            action: "DELETE",
            entityType: "User",
            entityId: id,
            userId: actorUserId,
            metadata: JSON.stringify({
              targetUserId: id,
              name: existing.name,
              username: existing.username,
              email: existing.email,
              role: existing.role,
              permanent: true,
            }),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new SystemUserError(
          "לא ניתן למחוק את המשתמש לצמיתות משום שקיימים מסמכים, פרויקטים או רשומות עסקיות המקושרים אליו. ניתן להשאיר אותו בארכיון."
        );
      }
      throw error;
    }

    return { ok: true };
  }

  static async resetPassword(
    id: string,
    password: string,
    actorUserId: string
  ) {
    if (password.length < 8) {
      throw new SystemUserError("סיסמה זמנית חייבת להכיל לפחות 8 תווים");
    }
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });
    if (!existing) throw new SystemUserError("משתמש לא נמצא", 404);
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "PASSWORD_RESET",
          entityType: "User",
          entityId: id,
          userId: actorUserId,
          metadata: JSON.stringify({
            targetUserId: id,
            username: existing.username,
          }),
        },
      }),
    ]);
    return { ok: true, username: existing.username };
  }
}
