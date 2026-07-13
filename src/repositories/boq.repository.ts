import { prisma } from "@/lib/prisma";
import { mapBoqItem } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";

export class BOQRepository {
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
