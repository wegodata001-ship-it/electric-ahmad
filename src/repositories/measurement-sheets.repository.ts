import { prisma } from "@/lib/prisma";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import {
  buildSignUrl,
  generateSignToken,
  hashSignToken,
  parseSignQuery,
} from "@/lib/documents/sign-tokens";
import type { MeasurementAxisType, MeasurementSheetStatus } from "@prisma/client";

function num(v: unknown): number {
  return Number(v ?? 0);
}

const sheetInclude = {
  rows: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      projectRoom: {
        select: {
          id: true,
          name: true,
          floor: true,
          code: true,
          sortOrder: true,
          isHidden: true,
          deletedAt: true,
        },
      },
    },
  },
  cells: {
    include: {
      boqItem: {
        select: {
          id: true,
          code: true,
          description: true,
          unit: true,
          contractQuantity: true,
          unitPrice: true,
          invoicedQuantity: true,
          deletedAt: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      measurementAxisType: true,
      measurementAxisLabel: true,
    },
  },
  approvals: {
    orderBy: { createdAt: "desc" as const },
    include: { approver: { select: { id: true, name: true, role: true } } },
  },
  reviewNotes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 40,
    include: { actor: { select: { id: true, name: true } } },
  },
  versions: { orderBy: { version: "desc" as const }, take: 20 },
} as const;

function isSheetEditable(status: MeasurementSheetStatus): boolean {
  return status === "draft" || status === "in_progress" || status === "revision";
}

function documentFolderForStatus(status: MeasurementSheetStatus): string {
  switch (status) {
    case "pending_approval":
      return "דוחות ביצוע/ממתין לאישור";
    case "revision":
      return "דוחות ביצוע/דורש תיקון";
    case "approved":
    case "locked":
      return "דוחות ביצוע/מאושר";
    case "invoiced":
      return "דוחות ביצוע/הופק לחשבון";
    case "draft":
    case "in_progress":
    default:
      return "דוחות ביצוע/טיוטות";
  }
}

function mapSheet(row: any) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    sequenceNumber: row.sequenceNumber,
    status: row.status as MeasurementSheetStatus,
    notes: row.notes,
    currentVersion: row.currentVersion ?? 1,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
    lastReturnComment: row.lastReturnComment ?? null,
    partialInvoiceId: row.partialInvoiceId,
    clientSignatureUrl: row.clientSignatureUrl ?? null,
    clientSignedName: row.clientSignedName ?? null,
    clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
    documentNumber: `MS-${row.sequenceNumber}`,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.project,
    editable: isSheetEditable(row.status),
    rows: (row.rows ?? [])
      .filter((r: any) => {
        if (r.projectRoom?.deletedAt) return false;
        if (r.projectRoom?.isHidden) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const sa = a.projectRoom?.sortOrder ?? a.sortOrder ?? 0;
        const sb = b.projectRoom?.sortOrder ?? b.sortOrder ?? 0;
        return sa - sb;
      })
      .map((r: any) => ({
        id: r.id,
        name: r.projectRoom?.name ?? r.name,
        sortOrder: r.projectRoom?.sortOrder ?? r.sortOrder,
        notes: r.notes,
        projectRoomId: r.projectRoomId ?? r.projectRoom?.id ?? null,
        floor: r.projectRoom?.floor ?? null,
        code: r.projectRoom?.code ?? null,
        isHidden: r.projectRoom?.isHidden ?? false,
      })),
    cells: (row.cells ?? [])
      .filter((c: any) => !c.boqItem?.deletedAt)
      .filter((c: any) => {
        const rowMeta = (row.rows ?? []).find((r: any) => r.id === c.rowId);
        if (!rowMeta) return true;
        if (rowMeta.projectRoom?.deletedAt) return false;
        if (rowMeta.projectRoom?.isHidden) return false;
        return true;
      })
      .map((c: any) => ({
        id: c.id,
        rowId: c.rowId,
        boqItemId: c.boqItemId,
        quantity: num(c.quantity),
        boqItem: c.boqItem
          ? {
              id: c.boqItem.id,
              code: c.boqItem.code,
              description: c.boqItem.description,
              unit: c.boqItem.unit,
              contractQuantity: num(c.boqItem.contractQuantity),
              unitPrice: num(c.boqItem.unitPrice),
              invoicedQuantity: num(c.boqItem.invoicedQuantity),
            }
          : null,
      })),
    approvals: (row.approvals ?? []).map((a: any) => ({
      id: a.id,
      approverId: a.approverId,
      approverName: a.approver?.name,
      status: a.status,
      comment: a.comment,
      sentAt: a.sentAt?.toISOString() ?? null,
      decidedAt: a.decidedAt?.toISOString() ?? null,
    })),
    reviewNotes: (row.reviewNotes ?? []).map((n: any) => ({
      id: n.id,
      rowId: n.rowId,
      boqItemId: n.boqItemId,
      comment: n.comment,
      version: n.version,
      authorId: n.authorId,
      authorName: n.author?.name,
      createdAt: n.createdAt.toISOString(),
    })),
    events: (row.events ?? []).map((e: any) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actorName: e.actor?.name,
      createdAt: e.createdAt.toISOString(),
    })),
    versions: (row.versions ?? []).map((v: any) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

export const AXIS_LABELS: Record<MeasurementAxisType, string> = {
  room: "חדר",
  floor: "קומה",
  building: "בניין",
  area: "אזור",
  custom: "יחידה",
};

export class MeasurementSheetsRepository {
  static async listByProject(projectId: string) {
    const rows = await prisma.measurementSheet.findMany({
      where: { projectId },
      orderBy: { sequenceNumber: "asc" },
      select: {
        id: true,
        title: true,
        sequenceNumber: true,
        status: true,
        currentVersion: true,
        partialInvoiceId: true,
        updatedAt: true,
        _count: { select: { rows: true, cells: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sequenceNumber: r.sequenceNumber,
      status: r.status,
      currentVersion: r.currentVersion,
      partialInvoiceId: r.partialInvoiceId,
      updatedAt: r.updatedAt.toISOString(),
      rowCount: r._count.rows,
      cellCount: r._count.cells,
    }));
  }

  static async getById(id: string) {
    const row = await prisma.measurementSheet.findUnique({
      where: { id },
      include: sheetInclude,
    });
    return row ? mapSheet(row) : null;
  }

  static async create(
    input: {
      projectId: string;
      title: string;
      notes?: string | null;
      rowNames?: string[];
      boqItemIds?: string[];
    },
    userId: string
  ) {
    const last = await prisma.measurementSheet.findFirst({
      where: { projectId: input.projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const title = input.title.trim() || `דף מדידה ${sequenceNumber}`;

    let boqItems = await prisma.boqItem.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        status: { not: "cancelled" },
        ...(input.boqItemIds?.length ? { id: { in: input.boqItemIds } } : {}),
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });

    // Without BOQ columns the grid is empty — seed starter sections so the table is fillable
    if (!boqItems.length && !input.boqItemIds?.length) {
      await this.seedStarterBoq(input.projectId, userId);
      boqItems = await prisma.boqItem.findMany({
        where: {
          projectId: input.projectId,
          deletedAt: null,
          status: { not: "cancelled" },
        },
        orderBy: { code: "asc" },
        select: { id: true },
      });
    }

    const projectRooms = await prisma.projectRoom.findMany({
      where: { projectId: input.projectId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });

    const rowNames =
      input.rowNames?.map((n) => n.trim()).filter(Boolean) ?? [];

    // אם אין חדרים בפרויקט — צור מ־rowNames; אחרת השתמש בחדרים הקיימים
    if (!projectRooms.length && rowNames.length) {
      const { ProjectRoomsRepository } = await import(
        "@/repositories/project-rooms.repository"
      );
      for (const name of rowNames) {
        await ProjectRoomsRepository.create(input.projectId, { name });
      }
    } else if (!projectRooms.length && !rowNames.length) {
      const { ProjectRoomsRepository } = await import(
        "@/repositories/project-rooms.repository"
      );
      for (const name of ["חדר 101", "חדר 102", "חדר 103"]) {
        await ProjectRoomsRepository.create(input.projectId, { name });
      }
    }

    const rooms = await prisma.projectRoom.findMany({
      where: { projectId: input.projectId, deletedAt: null, isHidden: false },
      orderBy: { sortOrder: "asc" },
    });

    const sheet = await prisma.$transaction(async (tx) => {
      const created = await tx.measurementSheet.create({
        data: {
          projectId: input.projectId,
          title,
          sequenceNumber,
          notes: input.notes ?? null,
          status: "draft",
          createdById: userId,
          updatedById: userId,
        },
      });

      if (rooms.length) {
        await tx.measurementSheetRow.createMany({
          data: rooms.map((room) => ({
            sheetId: created.id,
            name: room.name,
            sortOrder: room.sortOrder,
            projectRoomId: room.id,
          })),
        });
      }

      const rows = await tx.measurementSheetRow.findMany({
        where: { sheetId: created.id },
        orderBy: { sortOrder: "asc" },
      });

      if (rows.length && boqItems.length) {
        await tx.measurementCell.createMany({
          data: rows.flatMap((row) =>
            boqItems.map((b) => ({
              sheetId: created.id,
              rowId: row.id,
              boqItemId: b.id,
              quantity: 0,
            }))
          ),
        });
      }

      return created;
    });

    return this.getById(sheet.id);
  }

  static async updateMeta(
    id: string,
    input: { title?: string; notes?: string | null; status?: MeasurementSheetStatus },
    userId: string
  ) {
    const existing = await prisma.measurementSheet.findUnique({ where: { id } });
    if (!existing) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(existing.status)) {
      throw new Error("לא ניתן לערוך דף מדידה במצב הנוכחי");
    }

    await prisma.measurementSheet.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        notes: input.notes,
        status: input.status,
        updatedById: userId,
      },
    });
    return this.getById(id);
  }

  /** Default BOQ sections so measurement grids are never column-less. */
  static async seedStarterBoq(projectId: string, userId: string) {
    const existing = await prisma.boqItem.count({
      where: { projectId, deletedAt: null, status: { not: "cancelled" } },
    });
    if (existing > 0) return existing;

    const starters = [
      {
        code: "1.01",
        description: "התקנת לוחות חשמל",
        unit: "יח'",
        contractQuantity: 10,
        unitPrice: 2500,
      },
      {
        code: "1.02",
        description: "כבלים מא״ז",
        unit: "מ׳",
        contractQuantity: 500,
        unitPrice: 45,
      },
      {
        code: "1.03",
        description: "תאורה LED",
        unit: "יח'",
        contractQuantity: 80,
        unitPrice: 180,
      },
      {
        code: "1.04",
        description: "שקעים ומפסקים",
        unit: "יח'",
        contractQuantity: 120,
        unitPrice: 95,
      },
      {
        code: "1.05",
        description: "תעלות כבלים",
        unit: "מ׳",
        contractQuantity: 200,
        unitPrice: 35,
      },
    ];

    await prisma.boqItem.createMany({
      data: starters.map((item) => ({
        projectId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        contractQuantity: item.contractQuantity,
        completedQuantity: 0,
        invoicedQuantity: 0,
        remainingQuantity: item.contractQuantity,
        unitPrice: item.unitPrice,
        completedValue: 0,
        remainingValue: item.contractQuantity * item.unitPrice,
        progress: 0,
        status: "active" as const,
        itemKind: "regular" as const,
        createdById: userId,
        updatedById: userId,
      })),
    });
    return starters.length;
  }

  /**
   * Ensure every room×BOQ cell exists on the sheet.
   * Optionally seed starter BOQ when the project has none.
   */
  static async ensureBoqGrid(
    sheetId: string,
    userId: string,
    opts?: { seedIfEmpty?: boolean }
  ) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      select: { id: true, projectId: true, status: true },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }

    let boqItems = await prisma.boqItem.findMany({
      where: {
        projectId: sheet.projectId,
        deletedAt: null,
        status: { not: "cancelled" },
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });

    if (!boqItems.length && opts?.seedIfEmpty !== false) {
      await this.seedStarterBoq(sheet.projectId, userId);
      boqItems = await prisma.boqItem.findMany({
        where: {
          projectId: sheet.projectId,
          deletedAt: null,
          status: { not: "cancelled" },
        },
        orderBy: { code: "asc" },
        select: { id: true },
      });
    }

    if (!boqItems.length) {
      throw new Error("אין סעיפי כתב כמויות בפרויקט");
    }

    const rows = await prisma.measurementSheetRow.findMany({
      where: { sheetId },
      select: { id: true },
    });
    if (!rows.length) {
      throw new Error("אין חדרים בדף המדידה");
    }

    const existing = await prisma.measurementCell.findMany({
      where: { sheetId },
      select: { rowId: true, boqItemId: true },
    });
    const have = new Set(existing.map((c) => `${c.rowId}:${c.boqItemId}`));

    const missing = rows.flatMap((row) =>
      boqItems
        .filter((b) => !have.has(`${row.id}:${b.id}`))
        .map((b) => ({
          sheetId,
          rowId: row.id,
          boqItemId: b.id,
          quantity: 0,
        }))
    );

    if (missing.length) {
      await prisma.measurementCell.createMany({ data: missing });
      await prisma.measurementSheet.update({
        where: { id: sheetId },
        data: {
          updatedById: userId,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
    }

    return this.getById(sheetId);
  }

  static async addRows(sheetId: string, names: string[], userId: string) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }

    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) throw new Error("יש להזין שם יחידה");

    const { ProjectRoomsRepository } = await import(
      "@/repositories/project-rooms.repository"
    );
    for (const name of clean) {
      await ProjectRoomsRepository.create(sheet.projectId, { name });
    }

    await prisma.measurementSheet.update({
      where: { id: sheetId },
      data: {
        updatedById: userId,
        status: sheet.status === "revision" ? "revision" : "in_progress",
      },
    });

    return this.getById(sheetId);
  }

  static async setCellQuantity(
    sheetId: string,
    input: { rowId: string; boqItemId: string; quantity: number; note?: string | null },
    userId: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }

    const qty = Math.max(0, Number(input.quantity) || 0);

    const cell = await prisma.$transaction(async (tx) => {
      const existing = await tx.measurementCell.findUnique({
        where: {
          rowId_boqItemId: { rowId: input.rowId, boqItemId: input.boqItemId },
        },
      });

      const oldQuantity = existing ? num(existing.quantity) : 0;
      const updated = existing
        ? await tx.measurementCell.update({
            where: { id: existing.id },
            data: { quantity: qty },
          })
        : await tx.measurementCell.create({
            data: {
              sheetId,
              rowId: input.rowId,
              boqItemId: input.boqItemId,
              quantity: qty,
            },
          });

      await tx.measurementEntry.create({
        data: {
          sheetId,
          cellId: updated.id,
          boqItemId: input.boqItemId,
          rowId: input.rowId,
          oldQuantity,
          newQuantity: qty,
          note: input.note ?? null,
          actorId: userId,
        },
      });

      await tx.measurementSheet.update({
        where: { id: sheetId },
        data: {
          updatedById: userId,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });

      return updated;
    });

    return {
      id: cell.id,
      rowId: cell.rowId,
      boqItemId: cell.boqItemId,
      quantity: num(cell.quantity),
    };
  }

  /** Batch save all dirty cells in one transaction */
  static async setCellsBatch(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    userId: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }
    if (!cells.length) return { saved: 0 };

    await prisma.$transaction(async (tx) => {
      for (const input of cells) {
        const qty = Math.max(0, Number(input.quantity) || 0);
        const existing = await tx.measurementCell.findUnique({
          where: {
            rowId_boqItemId: { rowId: input.rowId, boqItemId: input.boqItemId },
          },
        });
        const oldQuantity = existing ? num(existing.quantity) : 0;
        if (existing && oldQuantity === qty) continue;

        const updated = existing
          ? await tx.measurementCell.update({
              where: { id: existing.id },
              data: { quantity: qty },
            })
          : await tx.measurementCell.create({
              data: {
                sheetId,
                rowId: input.rowId,
                boqItemId: input.boqItemId,
                quantity: qty,
              },
            });

        await tx.measurementEntry.create({
          data: {
            sheetId,
            cellId: updated.id,
            boqItemId: input.boqItemId,
            rowId: input.rowId,
            oldQuantity,
            newQuantity: qty,
            note: null,
            actorId: userId,
          },
        });
      }

      await tx.measurementSheet.update({
        where: { id: sheetId },
        data: {
          updatedById: userId,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
    });

    return { saved: cells.length, sheet: await this.getById(sheetId) };
  }

  /**
   * @deprecated Prefer submitForApproval — kept for backward compat (locks without approval)
   */
  static async completeSheet(sheetId: string, userId: string, printBaseUrl?: string) {
    return this.submitForApproval(sheetId, [], userId, printBaseUrl, {
      skipApprovers: true,
    });
  }

  static async ensureDocument(
    sheetId: string,
    userId: string,
    status: MeasurementSheetStatus,
    printBaseUrl?: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new Error("דף מדידה לא נמצא");

    const printPath = `/print/measurement-sheets/${sheetId}`;
    const url = printBaseUrl
      ? `${printBaseUrl.replace(/\/$/, "")}${printPath}`
      : printPath;
    const folderPath = documentFolderForStatus(status);
    const docName = `${sheet.title || `דף מדידה ${sheet.sequenceNumber}`}.pdf`;
    const path = `print/measurement-sheets/${sheetId}`;

    const existing = await prisma.document.findFirst({
      where: { projectId: sheet.projectId, path },
    });

    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          folderPath,
          name: docName,
          url,
          sourceType: "measurement_sheet",
          sourceId: sheetId,
          updatedById: userId,
        },
      });
      return { id: existing.id, name: docName, folderPath, url };
    }

    const doc = await prisma.document.create({
      data: {
        projectId: sheet.projectId,
        name: docName,
        type: "pdf",
        extension: "pdf",
        size: 0,
        bucket: "documents",
        path,
        url,
        folderPath,
        sourceType: "measurement_sheet",
        sourceId: sheetId,
        uploadedById: userId,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        versions: {
          create: {
            version: 1,
            size: 0,
            bucket: "documents",
            path,
            url,
            uploadedById: userId,
          },
        },
      },
    });
    return { id: doc.id, name: docName, folderPath, url };
  }

  private static async addEvent(
    sheetId: string,
    type: string,
    message: string,
    actorId: string,
    metadata?: unknown
  ) {
    await prisma.measurementSheetEvent.create({
      data: {
        sheetId,
        type,
        message,
        actorId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  private static async notify(
    userIds: string[],
    title: string,
    message: string,
    link: string,
    projectId: string
  ) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    await prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        projectId,
        type: "document" as const,
        title,
        message,
        link,
      })),
    });
  }

  /**
   * שליחה לאישור מנהל תפעול — יוצר גרסה חדשה ומעדכן תיקיית מסמכים
   */
  static async submitForApproval(
    sheetId: string,
    approverIds: string[],
    userId: string,
    printBaseUrl?: string,
    options?: { skipApprovers?: boolean }
  ) {
    const sheet = await this.getById(sheetId);
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status) && sheet.status !== "pending_approval") {
      if (sheet.status === "approved" || sheet.status === "locked" || sheet.status === "invoiced") {
        throw new Error("הדוח כבר אושר או חויב");
      }
    }
    if (!options?.skipApprovers && !approverIds.length) {
      throw new Error("יש לבחור לפחות מאשר אחד");
    }

    const lastVer = await prisma.measurementSheetVersion.findFirst({
      where: { sheetId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const versionRow = (lastVer?.version ?? 0) + 1;
    const docVersion =
      sheet.status === "revision" || sheet.submittedAt
        ? (sheet.currentVersion ?? 1) + 1
        : Math.max(1, sheet.currentVersion ?? 1);
    const snapshot = JSON.stringify(sheet);

    await prisma.$transaction(async (tx) => {
      await tx.measurementSheetApproval.updateMany({
        where: { sheetId, status: "pending" },
        data: { status: "cancelled" },
      });

      if (!options?.skipApprovers) {
        await tx.measurementSheetApproval.createMany({
          data: approverIds.map((approverId) => ({
            sheetId,
            approverId,
            status: "pending" as const,
          })),
        });
      }

      await tx.measurementSheetVersion.create({
        data: {
          sheetId,
          version: versionRow,
          status: options?.skipApprovers ? "approved" : "pending_approval",
          snapshotJson: snapshot,
          note: options?.skipApprovers
            ? `V${docVersion} אושר`
            : `V${docVersion} נשלח לאישור`,
          actorId: userId,
        },
      });

      await tx.measurementSheet.update({
        where: { id: sheetId },
        data: {
          status: options?.skipApprovers ? "approved" : "pending_approval",
          currentVersion: docVersion,
          submittedAt: new Date(),
          approvedAt: options?.skipApprovers ? new Date() : null,
          returnedAt: null,
          lastReturnComment: null,
          updatedById: userId,
        },
      });
    });

    const status: MeasurementSheetStatus = options?.skipApprovers
      ? "approved"
      : "pending_approval";
    const doc = await this.ensureDocument(sheetId, userId, status, printBaseUrl);

    await this.addEvent(
      sheetId,
      options?.skipApprovers ? "approved" : "submitted",
      options?.skipApprovers
        ? `V${docVersion} אושר (ללא מחזור אישור)`
        : `V${docVersion} נשלח לאישור`,
      userId,
      { version: docVersion, approverIds }
    );

    if (!options?.skipApprovers) {
      await this.notify(
        approverIds,
        "דוח ביצוע ממתין לאישור",
        `${sheet.title} (V${docVersion}) ממתין לאישורך`,
        `/approvals`,
        sheet.projectId
      );
    }

    await prisma.activity.create({
      data: {
        projectId: sheet.projectId,
        type: "status_changed",
        title: options?.skipApprovers ? "דוח ביצוע אושר" : "דוח ביצוע נשלח לאישור",
        description: `${sheet.title} · V${docVersion}`,
        userId,
        metadata: JSON.stringify({ sheetId, version: docVersion, status }),
      },
    });

    return { sheet: await this.getById(sheetId), document: doc };
  }

  static async decideApproval(
    sheetId: string,
    approverId: string,
    decision: "approved" | "rejected",
    comment?: string | null,
    reviewNotes?: { rowId?: string | null; boqItemId?: string | null; comment: string }[],
    printBaseUrl?: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      include: { approvals: true },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");

    const mine = sheet.approvals.find(
      (a) => a.approverId === approverId && a.status === "pending"
    );
    if (!mine) throw new Error("אין בקשת אישור ממתינה עבורך");

    if (decision === "rejected") {
      if (!comment?.trim() && !(reviewNotes?.length)) {
        throw new Error("חובה לרשום הערות מנהל להחזרה לתיקון");
      }
      const summary = comment?.trim() || "הוחזר לתיקון עם הערות על שורות";

      await prisma.$transaction(async (tx) => {
        await tx.measurementSheetApproval.update({
          where: { id: mine.id },
          data: { status: "rejected", comment: summary, decidedAt: new Date() },
        });
        await tx.measurementSheetApproval.updateMany({
          where: { sheetId, status: "pending" },
          data: { status: "cancelled" },
        });
        if (reviewNotes?.length) {
          await tx.measurementSheetReviewNote.createMany({
            data: reviewNotes
              .filter((n) => n.comment.trim())
              .map((n) => ({
                sheetId,
                rowId: n.rowId || null,
                boqItemId: n.boqItemId || null,
                comment: n.comment.trim(),
                version: sheet.currentVersion,
                authorId: approverId,
              })),
          });
        }
        const lastVer = await tx.measurementSheetVersion.findFirst({
          where: { sheetId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.measurementSheetVersion.create({
          data: {
            sheetId,
            version: (lastVer?.version ?? 0) + 1,
            status: "revision",
            snapshotJson: "{}",
            note: `V${sheet.currentVersion} הוחזר לתיקון: ${summary}`,
            actorId: approverId,
          },
        });
        await tx.measurementSheet.update({
          where: { id: sheetId },
          data: {
            status: "revision",
            returnedAt: new Date(),
            lastReturnComment: summary,
            updatedById: approverId,
          },
        });
      });

      await this.ensureDocument(sheetId, approverId, "revision", printBaseUrl);
      await this.addEvent(sheetId, "returned", `הוחזר לתיקון: ${summary}`, approverId, {
        reviewNotes,
      });
      await this.notify(
        [sheet.createdById],
        "דוח ביצוע דורש תיקון",
        `${sheet.title}: ${summary}`,
        `/invoices?projectId=${sheet.projectId}&module=performance`,
        sheet.projectId
      );

      return this.getById(sheetId);
    }

    await prisma.measurementSheetApproval.update({
      where: { id: mine.id },
      data: {
        status: "approved",
        comment: comment ?? null,
        decidedAt: new Date(),
      },
    });

    const pending = await prisma.measurementSheetApproval.count({
      where: { sheetId, status: "pending" },
    });

    if (pending === 0) {
      const lastVer = await prisma.measurementSheetVersion.findFirst({
        where: { sheetId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await prisma.measurementSheetVersion.create({
        data: {
          sheetId,
          version: (lastVer?.version ?? 0) + 1,
          status: "approved",
          snapshotJson: "{}",
          note: `V${sheet.currentVersion} אושר`,
          actorId: approverId,
        },
      });
      await prisma.measurementSheet.update({
        where: { id: sheetId },
        data: {
          status: "approved",
          approvedAt: new Date(),
          updatedById: approverId,
        },
      });
      await this.ensureDocument(sheetId, approverId, "approved", printBaseUrl);
      await this.addEvent(sheetId, "approved", `V${sheet.currentVersion} אושר`, approverId);
      await this.notify(
        [sheet.createdById],
        "דוח ביצוע אושר",
        `${sheet.title} אושר — ניתן להפיק חשבון`,
        `/invoices?projectId=${sheet.projectId}&module=performance`,
        sheet.projectId
      );
    } else {
      await this.addEvent(sheetId, "partial_approved", "אישור חלקי התקבל", approverId);
    }

    return this.getById(sheetId);
  }

  static async listPendingApprovals(approverId: string) {
    const rows = await prisma.measurementSheetApproval.findMany({
      where: { approverId, status: "pending" },
      include: {
        sheet: {
          select: {
            id: true,
            title: true,
            sequenceNumber: true,
            status: true,
            currentVersion: true,
            projectId: true,
            project: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    return rows.map((r) => ({
      kind: "measurement_sheet" as const,
      approvalId: r.id,
      documentId: r.sheetId,
      documentNumber: `MS-${r.sheet.sequenceNumber}`,
      title: r.sheet.title,
      projectName: r.sheet.project?.name,
      projectId: r.sheet.projectId,
      createdByName: r.sheet.createdBy?.name,
      version: r.sheet.currentVersion,
      status: r.sheet.status,
      sentAt: r.sentAt.toISOString(),
      link: `/operations/approvals/sheets/${r.sheetId}`,
    }));
  }

  /** Create WhatsApp/client signature link after office approval */
  static async createClientSignLink(
    sheetId: string,
    actorId: string,
    baseUrl: string
  ): Promise<{ url: string; documentNumber: string }> {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        status: true,
        sequenceNumber: true,
        title: true,
        projectId: true,
        createdById: true,
      },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (sheet.status !== "approved" && sheet.status !== "locked") {
      throw new Error("ניתן לשלוח ללקוח רק לאחר אישור הדוח");
    }

    await prisma.measurementSheetSignToken.updateMany({
      where: { sheetId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { raw, hash, publicId } = generateSignToken();
    await prisma.measurementSheetSignToken.create({
      data: {
        sheetId,
        tokenHash: hash,
        publicId,
        createdById: actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const documentNumber = `MS-${sheet.sequenceNumber}`;
    const url = buildSignUrl({
      baseUrl,
      kind: "measurement-sheet",
      documentNumber: sheetId,
      publicId,
      rawToken: raw,
    });

    await this.addEvent(
      sheetId,
      "sent_to_client",
      `נשלח ללקוח לחתימה · ${documentNumber}`,
      actorId,
      { url: url.slice(0, 200) }
    );

    await this.notify(
      [sheet.createdById, actorId],
      "דוח ביצוע נשלח ללקוח",
      `${sheet.title} (${documentNumber}) נשלח לחתימת לקוח`,
      `/operations/approvals/sheets/${sheetId}`,
      sheet.projectId
    );

    return { url, documentNumber };
  }

  static async getPublicForSign(sheetId: string, tokenParam: string) {
    const parsed = parseSignQuery(tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.measurementSheetSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        sheetId,
      },
      include: {
        sheet: { include: sheetInclude },
      },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.usedAt) throw new Error("הקישור כבר נוצל");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const mapped = mapSheet(token.sheet);
    return {
      ...mapped,
      kind: "measurement_sheet" as const,
      alreadySigned: Boolean(token.sheet.clientSignedAt),
    };
  }

  static async applyClientSignature(opts: {
    sheetId: string;
    tokenParam: string;
    signatureDataUrl: string;
    signerName: string;
    ip?: string | null;
    device?: string | null;
  }) {
    const parsed = parseSignQuery(opts.tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.measurementSheetSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        sheetId: opts.sheetId,
      },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.usedAt) throw new Error("הקישור כבר נוצל");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    await prisma.$transaction(async (tx) => {
      await tx.measurementSheetSignToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      await tx.measurementSheet.update({
        where: { id: opts.sheetId },
        data: {
          clientSignatureUrl: opts.signatureDataUrl,
          clientSignedName: opts.signerName,
          clientSignedAt: new Date(),
          clientSignedIp: opts.ip ?? null,
          clientSignedDevice: opts.device?.slice(0, 255) ?? null,
          status: "locked",
        },
      });
    });

    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: opts.sheetId },
      select: { createdById: true },
    });
    await this.addEvent(
      opts.sheetId,
      "client_signed",
      `נחתם ע״י לקוח: ${opts.signerName}`,
      token.createdById || sheet?.createdById || opts.sheetId
    );

    return this.getById(opts.sheetId);
  }

  static async listRevisionForCreator(userId: string) {
    const rows = await prisma.measurementSheet.findMany({
      where: { createdById: userId, status: "revision" },
      select: {
        id: true,
        title: true,
        sequenceNumber: true,
        projectId: true,
        lastReturnComment: true,
        currentVersion: true,
        project: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      projectId: r.projectId,
      projectName: r.project?.name,
      version: r.currentVersion,
      lastReturnComment: r.lastReturnComment,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  static async getEntries(sheetId: string, take = 100) {
    const rows = await prisma.measurementEntry.findMany({
      where: { sheetId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      cellId: r.cellId,
      boqItemId: r.boqItemId,
      rowId: r.rowId,
      oldQuantity: r.oldQuantity != null ? num(r.oldQuantity) : null,
      newQuantity: num(r.newQuantity),
      note: r.note,
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * ריכוז חשבון: לכל סעיף — חוזה, בוצע קודם (חויב), בוצע בתקופה (דפי מדידה פתוחים), מצטבר, יתרה, סכום
   */
  static async getProjectSummary(projectId: string, sheetIds?: string[]) {
    const sheets = await prisma.measurementSheet.findMany({
      where: {
        projectId,
        ...(sheetIds?.length
          ? { id: { in: sheetIds } }
          : { status: { in: ["approved", "locked"] as MeasurementSheetStatus[] } }),
        partialInvoiceId: null,
      },
      include: {
        cells: true,
      },
    });

    if (sheetIds?.length) {
      const invalid = sheets.filter(
        (s) => s.status !== "approved" && s.status !== "locked"
      );
      if (invalid.length) {
        throw new Error(
          "ניתן להפיק חשבון רק מדוחות ביצוע שאושרו על ידי מנהל תפעול"
        );
      }
    }

    const periodByBoq = new Map<string, number>();
    for (const sheet of sheets) {
      for (const cell of sheet.cells) {
        periodByBoq.set(
          cell.boqItemId,
          (periodByBoq.get(cell.boqItemId) ?? 0) + num(cell.quantity)
        );
      }
    }

    const boqItems = await prisma.boqItem.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: "asc" },
    });

    const lines = boqItems.map((b) => {
      const contractQuantity = num(b.contractQuantity);
      const previousQuantity = num(b.invoicedQuantity);
      const periodQuantity = periodByBoq.get(b.id) ?? 0;
      const available = Math.max(0, contractQuantity - previousQuantity);
      const billable = Math.min(periodQuantity, available);
      const cumulative = previousQuantity + billable;
      const remaining = Math.max(0, contractQuantity - cumulative);
      const unitPrice = num(b.unitPrice);
      return {
        boqItemId: b.id,
        code: b.code,
        description: b.description,
        unit: b.unit,
        unitPrice,
        contractQuantity,
        previousQuantity,
        periodQuantity,
        billableQuantity: billable,
        cumulativeQuantity: cumulative,
        remainingQuantity: remaining,
        amount: billable * unitPrice,
        itemKind: b.itemKind,
      };
    });

    const billableLines = lines.filter((l) => l.billableQuantity > 0);
    const subtotal = billableLines.reduce((s, l) => s + l.amount, 0);

    return {
      projectId,
      sheetIds: sheets.map((s) => s.id),
      sheetTitles: sheets.map((s) => s.title),
      lines,
      billableLines,
      subtotal,
    };
  }

  static async generateInvoice(
    projectId: string,
    input: {
      sheetIds?: string[];
      billingMonth?: string;
      createDocumentFolder?: boolean;
      notes?: string;
    },
    userId: string
  ) {
    const summary = await this.getProjectSummary(projectId, input.sheetIds);
    if (!summary.billableLines.length) {
      throw new Error("אין כמויות לחיוב בדפי המדידה שנבחרו");
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("פרויקט לא נמצא");

    // דפי מדידה הם מקור הביצוע — מעדכנים completed לפני/עם החיוב
    for (const line of summary.billableLines) {
      const boq = await prisma.boqItem.findUnique({ where: { id: line.boqItemId } });
      if (!boq) continue;
      const completed = Math.max(num(boq.completedQuantity), line.cumulativeQuantity);
      const contract = num(boq.contractQuantity);
      const remaining = Math.max(0, contract - completed);
      const unitPrice = num(boq.unitPrice);
      await prisma.boqItem.update({
        where: { id: line.boqItemId },
        data: {
          completedQuantity: completed,
          remainingQuantity: remaining,
          completedValue: completed * unitPrice,
          remainingValue: remaining * unitPrice,
          progress: contract > 0 ? Math.min(100, (completed / contract) * 100) : 0,
          updatedById: userId,
        },
      });
    }

    const invoice = await PartialInvoicesRepository.create(
      {
        projectId,
        date: new Date().toISOString().slice(0, 10),
        billingMonth: input.billingMonth,
        billTo: project.contractor,
        contractor: project.contractor,
        notes: input.notes ?? `הופק מדפי מדידה: ${summary.sheetTitles.join(", ")}`,
        status: "draft",
        quantitySource: "measurement",
        items: summary.billableLines.map((l) => ({
          boqItemId: l.boqItemId,
          quantity: l.billableQuantity,
        })),
      },
      userId
    );

    await prisma.measurementSheet.updateMany({
      where: { id: { in: summary.sheetIds } },
      data: {
        status: "invoiced",
        partialInvoiceId: invoice.id,
        updatedById: userId,
      },
    });

    for (const sid of summary.sheetIds) {
      await this.ensureDocument(sid, userId, "invoiced");
      await this.addEvent(sid, "invoiced", "הופק לחשבון", userId, {
        invoiceId: invoice.id,
      });
    }

    let documentFolder: string | null = null;
    if (input.createDocumentFolder !== false) {
      documentFolder = `חשבון ${invoice.sequenceNumber}`;
      // Placeholder marker document so the folder appears in project docs
      await prisma.document.create({
        data: {
          projectId,
          name: `${documentFolder} — תיקיית חשבון`,
          type: "other",
          extension: "folder",
          size: 0,
          bucket: "documents",
          path: `folders/${projectId}/${documentFolder}`,
          url: "",
          folderPath: documentFolder,
          partialInvoiceId: invoice.id,
          uploadedById: userId,
          ownerId: userId,
          createdById: userId,
          updatedById: userId,
        },
      });
    }

    return {
      invoice,
      summary,
      documentFolder,
    };
  }

  static async updateProjectAxis(
    projectId: string,
    input: { measurementAxisType: MeasurementAxisType; measurementAxisLabel?: string | null }
  ) {
    return prisma.project.update({
      where: { id: projectId },
      data: {
        measurementAxisType: input.measurementAxisType,
        measurementAxisLabel: input.measurementAxisLabel ?? null,
      },
      select: {
        id: true,
        measurementAxisType: true,
        measurementAxisLabel: true,
      },
    });
  }

  static async getProjectTree(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        contractor: true,
        location: true,
        measurementAxisType: true,
        measurementAxisLabel: true,
      },
    });
    if (!project) return null;

    const [boqCount, sheets, invoices, documents] = await Promise.all([
      prisma.boqItem.count({ where: { projectId, deletedAt: null } }),
      this.listByProject(projectId),
      PartialInvoicesRepository.findByProject(projectId),
      prisma.document.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          folderPath: true,
          type: true,
          url: true,
          partialInvoiceId: true,
          createdAt: true,
        },
      }),
    ]);

    const summary = await this.getProjectSummary(projectId);

    return {
      project: {
        ...project,
        axisLabel:
          project.measurementAxisLabel ||
          AXIS_LABELS[project.measurementAxisType] ||
          "יחידה",
      },
      boqCount,
      sheets,
      invoices,
      documents: documents.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
      summary: {
        subtotal: summary.subtotal,
        billableLineCount: summary.billableLines.length,
        openSheetCount: summary.sheetIds.length,
      },
    };
  }
}
