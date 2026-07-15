import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { BOQRepository } from "./boq.repository";
import type { ExecutionStatus } from "@prisma/client";

const COUNTING_STATUSES: ExecutionStatus[] = [
  "not_started",
  "in_progress",
  "partially_completed",
  "completed",
  "finished",
  "pending_approval",
  "approved",
];

const executionInclude = {
  employee: { select: { id: true, firstName: true, lastName: true } },
  foreman: { select: { id: true, firstName: true, lastName: true } },
  media: true,
  attachments: true,
  comments: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  history: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  boqItem: {
    select: {
      id: true,
      code: true,
      description: true,
      unit: true,
      contractQuantity: true,
      completedQuantity: true,
      remainingQuantity: true,
      invoicedQuantity: true,
      progress: true,
    },
  },
} as const;

function mapExecution(row: {
  id: string;
  projectId: string;
  boqItemId: string;
  employeeId: string;
  foremanId: string | null;
  quantity: { toString(): string } | number;
  executedAt: Date;
  status: ExecutionStatus;
  notes: string | null;
  source: string;
  workReportId: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; firstName: string; lastName: string };
  foreman: { id: string; firstName: string; lastName: string } | null;
  media: {
    id: string;
    type: string;
    name: string;
    url: string;
    thumbnailUrl: string | null;
  }[];
  attachments: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    kind: string;
    url: string;
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    user: { name: string };
  }[];
  history: {
    id: string;
    action: string;
    fromStatus: ExecutionStatus | null;
    toStatus: ExecutionStatus | null;
    quantity: { toString(): string } | number | null;
    createdAt: Date;
    user: { name: string };
  }[];
  boqItem?: {
    id: string;
    code: string;
    description: string;
    unit: string;
    contractQuantity: { toString(): string } | number;
    completedQuantity: { toString(): string } | number;
    remainingQuantity: { toString(): string } | number;
    invoicedQuantity: { toString(): string } | number;
    progress: number;
  };
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    boqItemId: row.boqItemId,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    foremanId: row.foremanId,
    foremanName: row.foreman
      ? `${row.foreman.firstName} ${row.foreman.lastName}`
      : null,
    quantity: Number(row.quantity),
    executedAt: row.executedAt.toISOString(),
    status: row.status,
    notes: row.notes,
    source: row.source,
    workReportId: row.workReportId,
    media: row.media.map((m) => ({
      id: m.id,
      type: m.type as "image" | "video",
      name: m.name,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      url: a.url,
    })),
    comments: row.comments.map((c) => ({
      id: c.id,
      body: c.body,
      userName: c.user.name,
      createdAt: c.createdAt.toISOString(),
    })),
    history: row.history.map((h) => ({
      id: h.id,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      quantity: h.quantity != null ? Number(h.quantity) : null,
      userName: h.user.name,
      createdAt: h.createdAt.toISOString(),
    })),
    boqItem: row.boqItem
      ? {
          id: row.boqItem.id,
          code: row.boqItem.code,
          description: row.boqItem.description,
          unit: row.boqItem.unit,
          contractQuantity: Number(row.boqItem.contractQuantity),
          executedQuantity: Number(row.boqItem.completedQuantity),
          remainingQuantity: Number(row.boqItem.remainingQuantity),
          invoicedQuantity: Number(row.boqItem.invoicedQuantity),
          progress: row.boqItem.progress,
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateBoqExecutionInput = {
  projectId: string;
  boqItemId: string;
  employeeId: string;
  foremanId?: string | null;
  quantity: number;
  executedAt?: string;
  status?: ExecutionStatus;
  notes?: string;
  source?: string;
  workReportId?: string | null;
};

export class BoqExecutionsRepository {
  /**
   * Recalculate executed qty from executions (+ legacy WorkReports without execution link).
   * Contract quantity is never modified. Invoiced quantity is never modified here.
   */
  static async recalculateBoqItem(boqItemId: string, userId: string) {
    const [execAgg, legacyAgg] = await Promise.all([
      prisma.boqExecution.aggregate({
        where: {
          boqItemId,
          status: { in: COUNTING_STATUSES },
        },
        _sum: { quantity: true },
      }),
      prisma.workReport.aggregate({
        where: {
          boqItemId,
          execution: null,
        },
        _sum: { quantity: true },
      }),
    ]);

    const executed =
      Number(execAgg._sum.quantity ?? 0) + Number(legacyAgg._sum.quantity ?? 0);

    const item = await BOQRepository.updateQuantities(boqItemId, executed, userId);

    // Refresh project progress from BOQ totals
    const boqItem = await prisma.boqItem.findUnique({
      where: { id: boqItemId },
      select: { projectId: true },
    });
    if (boqItem) {
      const all = await prisma.boqItem.findMany({
        where: { projectId: boqItem.projectId },
      });
      const completedValue = all.reduce(
        (s, b) => s + Number(b.completedValue),
        0
      );
      const contractValue = all.reduce(
        (s, b) => s + Number(b.contractQuantity) * Number(b.unitPrice),
        0
      );
      const progress =
        contractValue > 0
          ? Math.round((completedValue / contractValue) * 1000) / 10
          : 0;
      await prisma.project.update({
        where: { id: boqItem.projectId },
        data: { completedValue, progress, updatedById: userId },
      });
    }

    return item;
  }

  static async findByBoqItem(boqItemId: string) {
    const rows = await prisma.boqExecution.findMany({
      where: { boqItemId },
      include: executionInclude,
      orderBy: { executedAt: "desc" },
    });
    return rows.map(mapExecution);
  }

  static async findById(id: string) {
    const row = await prisma.boqExecution.findUnique({
      where: { id },
      include: executionInclude,
    });
    return row ? mapExecution(row) : null;
  }

  static async create(input: CreateBoqExecutionInput, userId: string) {
    if (!(Number(input.quantity) > 0)) {
      throw new Error("כמות הביצוע חייבת להיות גדולה מ-0");
    }

    const boq = await prisma.boqItem.findUnique({
      where: { id: input.boqItemId },
    });
    if (!boq) throw new Error("סעיף לא נמצא");
    if (boq.projectId !== input.projectId) {
      throw new Error("הסעיף אינו שייך לפרויקט");
    }

    const status = input.status ?? "in_progress";

    const created = await prisma.$transaction(async (tx) => {
      const execution = await tx.boqExecution.create({
        data: {
          projectId: input.projectId,
          boqItemId: input.boqItemId,
          employeeId: input.employeeId,
          foremanId: input.foremanId || null,
          quantity: Number(input.quantity),
          executedAt: input.executedAt
            ? new Date(input.executedAt)
            : new Date(),
          status,
          notes: input.notes?.trim() || null,
          source: input.source ?? "office",
          workReportId: input.workReportId || null,
          createdById: userId,
          updatedById: userId,
          history: {
            create: {
              action: "created",
              toStatus: status,
              quantity: Number(input.quantity),
              userId,
              metadata: JSON.stringify({ source: input.source ?? "office" }),
            },
          },
        },
        include: executionInclude,
      });

      await tx.activity.create({
        data: {
          projectId: input.projectId,
          type: "quantity_updated",
          title: "דיווח ביצוע",
          description: `דווח ביצוע ${input.quantity} ${boq.unit} בסעיף ${boq.code}`,
          userId,
          metadata: JSON.stringify({
            executionId: execution.id,
            boqItemId: input.boqItemId,
          }),
        },
      });

      return execution;
    });

    await this.recalculateBoqItem(input.boqItemId, userId);

    await AuditRepository.log({
      action: "CREATE",
      entityType: "BoqExecution",
      entityId: created.id,
      userId,
      metadata: {
        boqItemId: input.boqItemId,
        quantity: input.quantity,
        status,
        source: input.source ?? "office",
      },
    });

    const refreshed = await this.findById(created.id);
    return refreshed!;
  }

  static async softCancel(executionId: string, userId: string, reason?: string) {
    const existing = await prisma.boqExecution.findUnique({
      where: { id: executionId },
    });
    if (!existing) throw new Error("דיווח לא נמצא");
    if (existing.status === "cancelled") {
      throw new Error("הדיווח כבר בוטל");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boqExecution.update({
        where: { id: executionId },
        data: { status: "cancelled", updatedById: userId },
      });
      await tx.boqExecutionHistory.create({
        data: {
          executionId,
          action: "cancelled",
          fromStatus: existing.status,
          toStatus: "cancelled",
          quantity: existing.quantity,
          userId,
          metadata: JSON.stringify({ reason: reason ?? null }),
        },
      });
    });

    // Record kept — never hard-deleted
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "BoqExecution",
      entityId: executionId,
      userId,
      metadata: { action: "soft_cancel", reason },
    });

    await this.recalculateBoqItem(existing.boqItemId, userId);
    return this.findById(executionId);
  }

  static async addMedia(
    executionId: string,
    data: {
      type: "image" | "video";
      name: string;
      extension: string;
      size: number;
      bucket: string;
      path: string;
      url: string;
      thumbnailUrl?: string;
    }
  ) {
    return prisma.boqExecutionMedia.create({ data: { executionId, ...data } });
  }

  static async addAttachment(
    executionId: string,
    data: {
      name: string;
      mimeType: string;
      size: number;
      kind: string;
      bucket: string;
      path: string;
      url: string;
    }
  ) {
    return prisma.boqExecutionAttachment.create({
      data: { executionId, ...data },
    });
  }

  static async addComment(executionId: string, userId: string, body: string) {
    if (!body.trim()) throw new Error("הערה ריקה");
    return prisma.boqExecutionComment.create({
      data: { executionId, userId, body: body.trim() },
    });
  }
}
