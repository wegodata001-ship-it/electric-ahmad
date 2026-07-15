import { prisma } from "@/lib/prisma";
import { mapBoqItem } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";

export class BOQRepository {
  static async createMany(
    projectId: string,
    items: {
      code: string;
      description: string;
      unit: string;
      contractQuantity: number;
      unitPrice: number;
      chapter?: string | null;
      subChapter?: string | null;
      category?: string | null;
      sortOrder?: number;
      level?: number;
    }[],
    userId: string
  ) {
    const data = items.map((item, index) => {
      const contractQuantity = item.contractQuantity || 0;
      const unitPrice = item.unitPrice || 0;
      const remainingQuantity = contractQuantity;
      const remainingValue = contractQuantity * unitPrice;

      return {
        projectId,
        code: item.code || `${index + 1}`,
        description: item.description || "סעיף ללא תיאור",
        unit: item.unit || "יח'",
        contractQuantity,
        completedQuantity: 0,
        remainingQuantity,
        unitPrice,
        completedValue: 0,
        remainingValue,
        progress: 0,
        status: "not_started" as const,
        level: item.level ?? 0,
        createdById: userId,
        updatedById: userId,
      };
    });

    await prisma.boqItem.createMany({ data });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "BoqItem",
      entityId: projectId,
      userId,
      metadata: { count: data.length },
    });

    return this.findByProject(projectId);
  }

  static async findAll(projectId?: string) {
    const rows = await prisma.boqItem.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ projectId: "asc" }, { code: "asc" }],
    });
    return rows.map(mapBoqItem);
  }

  static async findById(id: string) {
    const row = await prisma.boqItem.findUnique({ where: { id } });
    return row ? mapBoqItem(row) : null;
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.boqItem.findMany({
      where: { projectId },
      orderBy: { code: "asc" },
    });
    return rows.map(mapBoqItem);
  }

  static async updateQuantities(
    id: string,
    completedQuantity: number,
    userId: string
  ) {
    const item = await prisma.boqItem.findUnique({ where: { id } });
    if (!item) throw new Error("סעיף לא נמצא");

    const contractQty = Number(item.contractQuantity);
    const remaining = Math.max(0, contractQty - completedQuantity);
    const unitPrice = Number(item.unitPrice);
    const completedValue = completedQuantity * unitPrice;
    const remainingValue = remaining * unitPrice;
    const progress = contractQty > 0 ? (completedQuantity / contractQty) * 100 : 0;

    let status = item.status;
    if (completedQuantity === 0) status = "not_started";
    else if (completedQuantity >= contractQty) status = "completed";
    else status = "in_progress";

    const row = await prisma.boqItem.update({
      where: { id },
      data: {
        completedQuantity,
        remainingQuantity: remaining,
        completedValue,
        remainingValue,
        progress: Math.round(progress * 10) / 10,
        status,
        updatedById: userId,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "BoqItem",
      entityId: id,
      userId,
      metadata: { completedQuantity, remaining },
    });

    return mapBoqItem(row);
  }
}
