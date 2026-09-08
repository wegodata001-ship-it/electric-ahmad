import { prisma } from "@/lib/prisma";
import { mapProject } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import { EmployeesRepository } from "./employees.repository";
import type { ProjectStatus } from "@prisma/client";

export class ProjectsRepository {
  static async findAll(status?: ProjectStatus) {
    const rows = await prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProject);
  }

  static async findById(id: string) {
    const row = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });
    return row ? mapProject(row) : null;
  }

  static async findRecent(limit = 5) {
    const rows = await prisma.project.findMany({
      where: { deletedAt: null },
      take: limit,
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProject);
  }

  static async create(
    data: {
      name: string;
      contractNumber: string;
      contractor: string;
      location: string;
      foremanId?: string;
      foremanName?: string;
      status?: ProjectStatus;
      contractValue: number;
      imageUrl?: string;
      startDate?: Date;
      endDate?: Date;
      description?: string;
    },
    userId: string
  ) {
    let foremanId = data.foremanId;
    if (!foremanId) {
      const foreman = await EmployeesRepository.ensureForeman(
        data.foremanName || "מנהל עבודה"
      );
      foremanId = foreman.id;
    }

    const startDate = data.startDate ?? new Date();
    const endDate =
      data.endDate ?? new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const row = await prisma.project.create({
      data: {
        name: data.name,
        contractNumber: data.contractNumber,
        contractor: data.contractor,
        location: data.location,
        foremanId,
        status: data.status ?? "planning",
        contractValue: data.contractValue,
        imageUrl: data.imageUrl,
        startDate,
        endDate,
        description: data.description,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
      },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });

    await prisma.projectEmployee.create({
      data: { projectId: row.id, employeeId: foremanId },
    });

    await prisma.activity.create({
      data: {
        projectId: row.id,
        type: "project_updated",
        title: "פרויקט חדש",
        description: `נוצר פרויקט ${data.name}`,
        userId,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "Project",
      entityId: row.id,
      userId,
    });

    const created = await prisma.project.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });

    return mapProject(created);
  }

  static async update(
    id: string,
    data: Partial<{
      name: string;
      contractor: string;
      location: string;
      foremanId: string;
      status: ProjectStatus;
      contractValue: number;
      completedValue: number;
      progress: number;
      imageUrl: string;
      imagePath: string;
      imageBucket: string;
      description: string;
      endDate: Date;
    }>,
    userId: string
  ) {
    const row = await prisma.project.update({
      where: { id },
      data: { ...data, updatedById: userId },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Project",
      entityId: id,
      userId,
      metadata: data as Record<string, unknown>,
    });

    return mapProject(row);
  }

  static async archive(id: string, userId: string, reason?: string) {
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        contractNumber: true,
        _count: {
          select: {
            measurementSheets: true,
            boqItems: true,
            invoices: true,
            invoiceApprovals: true,
            deliveryNotes: true,
            workDiaries: true,
            opsDeliveryNotes: true,
            documents: true,
            fieldAttendances: true,
            employees: true,
            activities: true,
            workflowDocuments: true,
          },
        },
      },
    });
    if (!project) throw new Error("פרויקט לא נמצא או שכבר נמחק");

    const shareLinks = await prisma.externalShareLink.count({
      where: { projectId: id },
    });
    const deletedAt = new Date();
    const metadata = {
      projectName: project.name,
      contractNumber: project.contractNumber,
      reason: reason?.trim() || null,
      deletionMode: "archive",
      linkedEntities: {
        ...project._count,
        shareLinks,
      },
      deletedAt: deletedAt.toISOString(),
    };

    await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: {
          deletedAt,
          deletedById: userId,
          deletionReason: reason?.trim() || null,
          updatedById: userId,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "DELETE",
          entityType: "Project",
          entityId: id,
          userId,
          metadata: JSON.stringify(metadata),
        },
      }),
      prisma.activity.create({
        data: {
          projectId: id,
          type: "project_updated",
          title: "הפרויקט הועבר לארכיון",
          description: reason?.trim()
            ? `סיבה: ${reason.trim()}`
            : "הפרויקט הועבר לארכיון על ידי מנהל מערכת",
          userId,
        },
      }),
      prisma.externalShareLink.updateMany({
        where: { projectId: id, revokedAt: null },
        data: { revokedAt: deletedAt },
      }),
      prisma.measurementSheetSignToken.updateMany({
        where: {
          sheet: { projectId: id },
          revokedAt: null,
        },
        data: { revokedAt: deletedAt },
      }),
      prisma.workDiarySignToken.updateMany({
        where: {
          workDiary: { projectId: id },
          revokedAt: null,
        },
        data: { revokedAt: deletedAt },
      }),
      prisma.opsDeliveryNoteSignToken.updateMany({
        where: {
          opsDeliveryNote: { projectId: id },
          revokedAt: null,
        },
        data: { revokedAt: deletedAt },
      }),
    ]);

    return {
      id,
      archived: true,
      deletedAt: deletedAt.toISOString(),
      linkedEntities: metadata.linkedEntities,
    };
  }
}
