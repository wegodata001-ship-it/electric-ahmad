import { prisma } from "@/lib/prisma";
import { mapWorkReport } from "@/lib/mappers";
import { BOQRepository } from "./boq.repository";
import { AuditRepository } from "./audit.repository";

export class ReportsRepository {
  static reportInclude = {
    project: { select: { name: true } },
    boqItem: { select: { code: true, description: true, unit: true } },
    employee: { select: { firstName: true, lastName: true } },
    media: { select: { type: true, url: true } },
  } as const;

  static async findAll() {
    const rows = await prisma.workReport.findMany({
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.workReport.findMany({
      where: { projectId },
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async findByEmployee(employeeId: string) {
    const rows = await prisma.workReport.findMany({
      where: { employeeId },
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async findByBoqItem(boqItemId: string) {
    const rows = await prisma.workReport.findMany({
      where: { boqItemId },
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async findToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const rows = await prisma.workReport.findMany({
      where: { reportedAt: { gte: start, lte: end } },
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async findRecent(limit = 10) {
    const rows = await prisma.workReport.findMany({
      take: limit,
      include: this.reportInclude,
      orderBy: { reportedAt: "desc" },
    });
    return rows.map(mapWorkReport);
  }

  static async create(
    data: {
      projectId: string;
      boqItemId: string;
      employeeId: string;
      quantity: number;
      notes?: string;
      reportedAt?: Date;
    },
    userId: string
  ) {
    const boqItem = await prisma.boqItem.findUnique({ where: { id: data.boqItemId } });
    if (!boqItem) throw new Error("סעיף BOQ לא נמצא");

    const newCompleted = Number(boqItem.completedQuantity) + data.quantity;
    await BOQRepository.updateQuantities(data.boqItemId, newCompleted, userId);

    const row = await prisma.workReport.create({
      data: {
        projectId: data.projectId,
        boqItemId: data.boqItemId,
        employeeId: data.employeeId,
        quantity: data.quantity,
        notes: data.notes,
        reportedAt: data.reportedAt ?? new Date(),
        createdById: userId,
        updatedById: userId,
      },
      include: this.reportInclude,
    });

    await prisma.activity.create({
      data: {
        projectId: data.projectId,
        type: "report_created",
        title: "דיווח חדש",
        description: `דיווח ${data.quantity} ${boqItem.unit} ב-${boqItem.description}`,
        userId,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "WorkReport",
      entityId: row.id,
      userId,
      metadata: { quantity: data.quantity, boqItemId: data.boqItemId },
    });

    return mapWorkReport(row);
  }
}
