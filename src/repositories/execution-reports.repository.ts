import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type CreateExecutionReportInput = {
  projectId: string;
  reportedAt: Date;
  foremanId?: string;
  notes?: string;
  items: {
    boqItemId: string;
    quantity: number;
    notes?: string;
  }[];
  createdById: string;
};

export type UpdateExecutionReportInput = Partial<
  Omit<CreateExecutionReportInput, "projectId" | "createdById">
>;

export type ExecutionReportWithItems = Prisma.ExecutionReportGetPayload<{
  include: {
    items: {
      include: {
        boqItem: true;
        invoice: true;
      };
    };
    foreman: true;
    media: true;
    attachments: true;
    createdBy: true;
    updatedBy: true;
  };
}>;

export class ExecutionReportsRepository {
  /**
   * Generate next report number for project
   */
  static async generateReportNumber(projectId: string): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { contractNumber: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const lastReport = await prisma.executionReport.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });

    const nextSeq = (lastReport?.sequenceNumber ?? 0) + 1;
    const year = new Date().getFullYear();
    
    // Format: ER-{year}-{seq}
    return `ER-${year}-${nextSeq.toString().padStart(4, "0")}`;
  }

  /**
   * Create a new execution report with items
   */
  static async create(input: CreateExecutionReportInput): Promise<ExecutionReportWithItems> {
    await this.assertItemsDoNotExceedRemainingQuantity(
      input.projectId,
      input.items
    );

    const reportNumber = await this.generateReportNumber(input.projectId);

    const lastReport = await prisma.executionReport.findFirst({
      where: { projectId: input.projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });

    const sequenceNumber = (lastReport?.sequenceNumber ?? 0) + 1;

    const report = await prisma.executionReport.create({
      data: {
        reportNumber,
        sequenceNumber,
        projectId: input.projectId,
        reportedAt: input.reportedAt,
        foremanId: input.foremanId,
        notes: input.notes,
        status: "submitted",
        createdById: input.createdById,
        updatedById: input.createdById,
        items: {
          create: input.items.map((item) => ({
            boqItemId: item.boqItemId,
            quantity: new Prisma.Decimal(item.quantity),
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: {
            boqItem: true,
            invoice: true,
          },
        },
        foreman: true,
        media: true,
        attachments: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    // Update BOQ item completedQuantity
    await this.updateBoqQuantitiesFromReports(input.projectId);

    return report;
  }

  /**
   * A performance report must never move a BOQ item past its contract quantity.
   * This is intentionally enforced server-side as well as in the reporting modal,
   * so direct API calls cannot create an invalid quantity.
   */
  private static async assertItemsDoNotExceedRemainingQuantity(
    projectId: string,
    items: CreateExecutionReportInput["items"]
  ): Promise<void> {
    const quantityByBoqItem = new Map<string, Prisma.Decimal>();

    for (const item of items) {
      const quantity = new Prisma.Decimal(item.quantity);
      if (!item.boqItemId || !quantity.isFinite() || quantity.lte(0)) {
        throw new Error("כמות הדיווח אינה תקינה");
      }
      quantityByBoqItem.set(
        item.boqItemId,
        (quantityByBoqItem.get(item.boqItemId) ?? new Prisma.Decimal(0)).plus(
          quantity
        )
      );
    }

    const boqItemIds = [...quantityByBoqItem.keys()];
    const boqItems = await prisma.boqItem.findMany({
      where: { id: { in: boqItemIds }, projectId, deletedAt: null },
      select: {
        id: true,
        code: true,
        unit: true,
        contractQuantity: true,
        completedQuantity: true,
      },
    });

    if (boqItems.length !== boqItemIds.length) {
      throw new Error("אחד מסעיפי כתב הכמויות אינו שייך לפרויקט");
    }

    for (const boqItem of boqItems) {
      const requested = quantityByBoqItem.get(boqItem.id)!;
      const remaining = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        boqItem.contractQuantity.minus(boqItem.completedQuantity)
      );

      if (requested.gt(remaining)) {
        throw new Error(
          `לא ניתן לדווח ${requested.toString()} ${boqItem.unit} בסעיף ${boqItem.code}. נותרו ${remaining.toString()} ${boqItem.unit} בלבד`
        );
      }
    }
  }

  /**
   * Update BOQ item completedQuantity based on all execution reports
   * OPTIMIZED: Single query per BOQ item instead of loop
   */
  static async updateBoqQuantitiesFromReports(projectId: string): Promise<void> {
    // Get all execution report items for this project (not cancelled)
    const reportItems = await prisma.executionReportItem.findMany({
      where: {
        report: {
          projectId,
          status: { not: "cancelled" },
        },
      },
      select: {
        boqItemId: true,
        quantity: true,
      },
    });

    // Group by BOQ item and sum quantities
    const quantitiesByBoqItem = new Map<string, Prisma.Decimal>();
    for (const item of reportItems) {
      const current = quantitiesByBoqItem.get(item.boqItemId) ?? new Prisma.Decimal(0);
      quantitiesByBoqItem.set(item.boqItemId, current.plus(item.quantity));
    }

    // Get all BOQ items for the project
    const boqItems = await prisma.boqItem.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, contractQuantity: true, unitPrice: true },
    });

    // Prepare bulk update
    const updates = boqItems.map((boqItem) => {
      const completedQuantity = quantitiesByBoqItem.get(boqItem.id) ?? new Prisma.Decimal(0);
      const contractQuantity = boqItem.contractQuantity;
      const remainingQuantity = contractQuantity.minus(completedQuantity);
      const completedValue = completedQuantity.times(boqItem.unitPrice);
      const remainingValue = remainingQuantity.times(boqItem.unitPrice);
      const progress = contractQuantity.isZero()
        ? 0
        : completedQuantity.dividedBy(contractQuantity).toNumber() * 100;

      return prisma.boqItem.update({
        where: { id: boqItem.id },
        data: {
          completedQuantity,
          remainingQuantity,
          completedValue,
          remainingValue,
          progress: Math.min(progress, 100),
        },
      });
    });

    // Execute all updates in parallel
    await Promise.all(updates);
  }

  /**
   * Get all execution reports for a project
   */
  static async findByProject(projectId: string): Promise<ExecutionReportWithItems[]> {
    return prisma.executionReport.findMany({
      where: { projectId },
      include: {
        items: {
          include: {
            boqItem: true,
            invoice: true,
          },
        },
        foreman: true,
        media: true,
        attachments: true,
        createdBy: true,
        updatedBy: true,
      },
      orderBy: { reportedAt: "desc" },
    });
  }

  /**
   * Get a single execution report by ID
   */
  static async findById(id: string): Promise<ExecutionReportWithItems | null> {
    return prisma.executionReport.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            boqItem: true,
            invoice: true,
          },
        },
        foreman: true,
        media: true,
        attachments: true,
        createdBy: true,
        updatedBy: true,
      },
    });
  }

  /**
   * Get uninvoiced execution report items for a project
   * Returns items that have been executed but not yet invoiced
   */
  static async getUninvoicedItems(projectId: string): Promise<{
    boqItemId: string;
    boqItem: any;
    totalExecuted: number;
    totalInvoiced: number;
    pendingInvoice: number;
    reports: Array<{
      reportId: string;
      reportNumber: string;
      reportedAt: Date;
      quantity: number;
    }>;
  }[]> {
    // Get all execution report items for this project
    const reportItems = await prisma.executionReportItem.findMany({
      where: {
        invoiced: false,
        report: {
          projectId,
          status: "submitted",
        },
      },
      include: {
        boqItem: true,
        report: {
          select: {
            id: true,
            reportNumber: true,
            reportedAt: true,
          },
        },
      },
      orderBy: {
        report: {
          reportedAt: "asc",
        },
      },
    });

    // Group by BOQ item
    const grouped = new Map<string, typeof reportItems>();
    for (const item of reportItems) {
      const existing = grouped.get(item.boqItemId) ?? [];
      existing.push(item);
      grouped.set(item.boqItemId, existing);
    }

    // Calculate totals for each BOQ item
    const result = [];
    for (const [boqItemId, items] of grouped) {
      const totalExecuted = items.reduce(
        (sum, item) => sum + item.quantity.toNumber(),
        0
      );

      // Get total already invoiced for this BOQ item
      const invoicedSum = await prisma.invoiceItem.aggregate({
        where: {
          boqItemId,
          invoice: {
            projectId,
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const totalInvoiced = invoicedSum._sum.quantity?.toNumber() ?? 0;
      const pendingInvoice = totalExecuted;

      result.push({
        boqItemId,
        boqItem: items[0].boqItem,
        totalExecuted,
        totalInvoiced,
        pendingInvoice,
        reports: items.map((item) => ({
          reportId: item.report.id,
          reportNumber: item.report.reportNumber,
          reportedAt: item.report.reportedAt,
          quantity: item.quantity.toNumber(),
        })),
      });
    }

    return result;
  }

  /**
   * Mark execution report items as invoiced
   */
  static async markItemsAsInvoiced(
    reportItemIds: string[],
    invoiceId: string,
    userId: string
  ): Promise<void> {
    await prisma.executionReportItem.updateMany({
      where: {
        id: { in: reportItemIds },
      },
      data: {
        invoiced: true,
        invoicedAt: new Date(),
        invoiceId,
      },
    });
  }

  /**
   * Update execution report
   */
  static async update(
    id: string,
    input: UpdateExecutionReportInput,
    userId: string
  ): Promise<ExecutionReportWithItems> {
    const report = await prisma.executionReport.update({
      where: { id },
      data: {
        reportedAt: input.reportedAt,
        foremanId: input.foremanId,
        notes: input.notes,
        updatedById: userId,
      },
      include: {
        items: {
          include: {
            boqItem: true,
            invoice: true,
          },
        },
        foreman: true,
        media: true,
        attachments: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    return report;
  }

  /**
   * Cancel execution report
   */
  static async cancel(id: string, userId: string): Promise<ExecutionReportWithItems> {
    const report = await prisma.executionReport.update({
      where: { id },
      data: {
        status: "cancelled",
        updatedById: userId,
      },
      include: {
        items: {
          include: {
            boqItem: true,
            invoice: true,
          },
        },
        foreman: true,
        media: true,
        attachments: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    // Recalculate BOQ quantities after cancellation
    await this.updateBoqQuantitiesFromReports(report.projectId);

    return report;
  }

  /**
   * Delete execution report
   */
  static async delete(id: string): Promise<void> {
    const report = await prisma.executionReport.findUnique({
      where: { id },
      select: { projectId: true },
    });

    await prisma.executionReport.delete({
      where: { id },
    });

    if (report) {
      await this.updateBoqQuantitiesFromReports(report.projectId);
    }
  }
}
