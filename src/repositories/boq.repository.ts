import { prisma } from "@/lib/prisma";
import { mapBoqItem } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import type { BoqItemKind, BoqItemStatus, Prisma } from "@prisma/client";
import {
  buildPageInfo,
  type ListPageInfo,
  type ListSortDir,
} from "@/lib/api/list-query";
import type { BoqItem } from "@/types";

export type BoqItemWriteInput = {
  projectId: string;
  code?: string | null;
  description: string;
  unit?: string;
  contractQuantity: number;
  unitPrice: number;
  category?: string | null;
  notes?: string | null;
  itemKind?: BoqItemKind;
  status?: BoqItemStatus;
};

export type BoqItemUpdateInput = {
  code?: string;
  description?: string;
  unit?: string;
  contractQuantity?: number;
  unitPrice?: number;
  category?: string | null;
  notes?: string | null;
  itemKind?: BoqItemKind;
  status?: BoqItemStatus;
};

function derivedFields(contractQuantity: number, unitPrice: number, completedQuantity: number) {
  const remaining = Math.max(0, contractQuantity - completedQuantity);
  const completedValue = completedQuantity * unitPrice;
  const remainingValue = remaining * unitPrice;
  const progress =
    contractQuantity > 0 ? Math.round((completedQuantity / contractQuantity) * 1000) / 10 : 0;
  return { remaining, completedValue, remainingValue, progress };
}

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
        invoicedQuantity: 0,
        remainingQuantity,
        unitPrice,
        completedValue: 0,
        remainingValue,
        progress: 0,
        status: "active" as const,
        itemKind: "regular" as const,
        category: item.category ?? item.chapter ?? null,
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

  static async create(input: BoqItemWriteInput, userId: string) {
    const contractQuantity = Number(input.contractQuantity) || 0;
    const unitPrice = Number(input.unitPrice) || 0;
    const { remaining, completedValue, remainingValue, progress } = derivedFields(
      contractQuantity,
      unitPrice,
      0
    );

    const row = await prisma.boqItem.create({
      data: {
        projectId: input.projectId,
        code: input.code?.trim() || "חריג",
        description: input.description.trim(),
        unit: input.unit?.trim() || "יח'",
        contractQuantity,
        unitPrice,
        completedQuantity: 0,
        invoicedQuantity: 0,
        remainingQuantity: remaining,
        completedValue,
        remainingValue,
        progress,
        status: input.status ?? "active",
        itemKind: input.itemKind ?? "exceptional",
        category: input.category?.trim() || null,
        notes: input.notes?.trim() || null,
        createdById: userId,
        updatedById: userId,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "BoqItem",
      entityId: row.id,
      userId,
      metadata: {
        code: row.code,
        itemKind: row.itemKind,
        description: row.description,
      },
    });

    return mapBoqItem(row);
  }

  static async update(id: string, input: BoqItemUpdateInput, userId: string) {
    const existing = await prisma.boqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("סעיף לא נמצא");

    const contractQuantity =
      input.contractQuantity !== undefined
        ? Number(input.contractQuantity)
        : Number(existing.contractQuantity);
    const unitPrice =
      input.unitPrice !== undefined ? Number(input.unitPrice) : Number(existing.unitPrice);
    const completedQuantity = Number(existing.completedQuantity);
    const { remaining, completedValue, remainingValue, progress } = derivedFields(
      contractQuantity,
      unitPrice,
      completedQuantity
    );

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const track = (field: string, from: unknown, to: unknown) => {
      if (from !== to) changes[field] = { from, to };
    };

    if (input.code !== undefined) track("code", existing.code, input.code);
    if (input.description !== undefined) track("description", existing.description, input.description);
    if (input.unit !== undefined) track("unit", existing.unit, input.unit);
    if (input.contractQuantity !== undefined) {
      track("contractQuantity", Number(existing.contractQuantity), contractQuantity);
    }
    if (input.unitPrice !== undefined) {
      track("unitPrice", Number(existing.unitPrice), unitPrice);
    }
    if (input.category !== undefined) track("category", existing.category, input.category);
    if (input.notes !== undefined) track("notes", existing.notes, input.notes);
    if (input.itemKind !== undefined) track("itemKind", existing.itemKind, input.itemKind);
    if (input.status !== undefined) track("status", existing.status, input.status);

    const row = await prisma.boqItem.update({
      where: { id },
      data: {
        code: input.code?.trim(),
        description: input.description?.trim(),
        unit: input.unit?.trim(),
        contractQuantity,
        unitPrice,
        remainingQuantity: remaining,
        completedValue,
        remainingValue,
        progress,
        category: input.category === undefined ? undefined : input.category?.trim() || null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        itemKind: input.itemKind,
        status: input.status,
        updatedById: userId,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "BoqItem",
      entityId: id,
      userId,
      metadata: { changes },
    });

    return mapBoqItem(row);
  }

  static async softDelete(id: string, userId: string) {
    const existing = await prisma.boqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("סעיף לא נמצא");

    await prisma.boqItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userId,
        updatedById: userId,
      },
    });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "BoqItem",
      entityId: id,
      userId,
      metadata: { code: existing.code, soft: true },
    });
  }

  static async getHistory(id: string) {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "BoqItem", entityId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
      user: l.user,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
    }));
  }

  static async findAll(projectId?: string) {
    const rows = await prisma.boqItem.findMany({
      where: {
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ projectId: "asc" }, { code: "asc" }],
    });
    return rows.map(mapBoqItem);
  }

  static async findById(id: string) {
    const row = await prisma.boqItem.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? mapBoqItem(row) : null;
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.boqItem.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: "asc" },
    });
    return rows.map(mapBoqItem);
  }

  /**
   * Server paginated BOQ list with q/kind/status filters and sort.
   * Returns `{ items, total, pageInfo }`.
   */
  static async listPage(opts: {
    projectId?: string;
    q?: string | null;
    itemKind?: BoqItemKind | "all" | null;
    status?: BoqItemStatus | "all" | null;
    sort?: string | null;
    dir?: ListSortDir;
    take: number;
    skip: number;
  }): Promise<{
    items: BoqItem[];
    total: number;
    pageInfo: ListPageInfo;
  }> {
    const take = Math.max(1, Math.min(opts.take, 200));
    const skip = Math.max(0, opts.skip);
    const dir: ListSortDir = opts.dir === "desc" ? "desc" : "asc";

    const where: Prisma.BoqItemWhereInput = { deletedAt: null };
    if (opts.projectId) where.projectId = opts.projectId;
    if (opts.itemKind && opts.itemKind !== "all") {
      where.itemKind = opts.itemKind;
    }
    if (opts.status && opts.status !== "all") {
      where.status = opts.status;
    }
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.BoqItemOrderByWithRelationInput[] = (() => {
      switch (opts.sort) {
        case "updatedAt":
          return [{ updatedAt: dir }, { id: dir }];
        case "contractQuantity":
          return [{ contractQuantity: dir }, { id: dir }];
        case "code":
        default:
          return [{ code: dir }, { id: dir }];
      }
    })();

    const [rows, total] = await Promise.all([
      prisma.boqItem.findMany({ where, orderBy, take, skip }),
      prisma.boqItem.count({ where }),
    ]);

    const items = rows.map(mapBoqItem);
    const page = take > 0 ? Math.floor(skip / take) + 1 : 1;
    const pageInfo = buildPageInfo({
      take,
      skip,
      page,
      fetchedCount: rows.length,
      returnedCount: rows.length,
      total,
    });

    return { items, total, pageInfo };
  }

  /** Updates executed quantities only — does not change managerial status */
  static async updateQuantities(
    id: string,
    completedQuantity: number,
    userId: string
  ) {
    const item = await prisma.boqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new Error("סעיף לא נמצא");

    const contractQty = Number(item.contractQuantity);
    const unitPrice = Number(item.unitPrice);
    const { remaining, completedValue, remainingValue, progress } = derivedFields(
      contractQty,
      unitPrice,
      completedQuantity
    );

    const row = await prisma.boqItem.update({
      where: { id },
      data: {
        completedQuantity,
        remainingQuantity: remaining,
        completedValue,
        remainingValue,
        progress,
        updatedById: userId,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "BoqItem",
      entityId: id,
      userId,
      metadata: { completedQuantity, remaining, source: "quantities" },
    });

    return mapBoqItem(row);
  }
}
