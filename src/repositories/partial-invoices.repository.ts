import { prisma } from "@/lib/prisma";
import { mapPartialInvoice } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import {
  availableForInvoice,
  computeInvoiceLine,
  formatBillingMonth,
} from "@/utils/invoice-calc";
import { cleanBoqDescription } from "@/utils/boq-text";
import {
  assertDocumentMutable,
  INVOICE_EDITABLE_STATUSES,
} from "@/lib/workflow/document-guards";

export type CreatePartialInvoiceInput = {
  projectId: string;
  date: string;
  dueDate?: string;
  billingMonth?: string;
  billTo?: string;
  contractor?: string;
  notes?: string;
  status?:
    | "draft"
    | "pending_foreman_approval"
    | "approved_by_foreman"
    | "rejected_by_foreman"
    | "sent_to_client"
    | "paid"
    | "submitted"
    | "approved"
    | "rejected";
  items: { boqItemId: string; quantity: number }[];
  /** When set, only these execution reports are marked as invoiced. */
  reportIds?: string[];
  /**
   * execution (default): זמין = בוצע − חויב
   * measurement: זמין = חוזה − חויב (מקור הכמויות הוא דפי מדידה)
   */
  quantitySource?: "execution" | "measurement";
};

export type UpdatePartialInvoiceInput = {
  date?: string;
  dueDate?: string;
  billingMonth?: string;
  billTo?: string;
  contractor?: string;
  notes?: string;
  /**
   * Accepted for backward compatibility only — the value is IGNORED by
   * `PartialInvoicesRepository.update`. Status transitions must go through the
   * dedicated approval / send / sign workflow endpoints.
   */
  status?: CreatePartialInvoiceInput["status"];
  items: {
    boqItemId: string;
    quantity: number;
    unitPrice?: number;
    description?: string;
    unit?: string;
  }[];
};

export class PartialInvoicesRepository {
  static invoiceInclude = {
    project: {
      select: {
        name: true,
        contractNumber: true,
        location: true,
        foreman: { select: { firstName: true, lastName: true } },
      },
    },
    items: true,
  } as const;

  static async findAll() {
    const rows = await prisma.partialInvoice.findMany({
      include: this.invoiceInclude,
      orderBy: [{ date: "desc" }, { sequenceNumber: "desc" }],
    });
    return rows.map(mapPartialInvoice);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.partialInvoice.findMany({
      where: { projectId },
      include: this.invoiceInclude,
      orderBy: [{ sequenceNumber: "desc" }],
    });
    return rows.map(mapPartialInvoice);
  }

  static async findById(id: string) {
    const row = await prisma.partialInvoice.findUnique({
      where: { id },
      include: this.invoiceInclude,
    });
    return row ? mapPartialInvoice(row) : null;
  }

  static async nextSequence(projectId: string): Promise<number> {
    const latest = await prisma.partialInvoice.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (latest?.sequenceNumber ?? 0) + 1;
  }

  static async create(input: CreatePartialInvoiceInput, userId: string) {
    if (!input.items?.length) {
      throw new Error("יש להוסיף לפחות סעיף אחד לחשבון");
    }

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
    });
    if (!project) throw new Error("פרויקט לא נמצא");

    const boqIds = input.items.map((i) => i.boqItemId);
    const boqRows = await prisma.boqItem.findMany({
      where: { id: { in: boqIds }, projectId: input.projectId, deletedAt: null },
    });
    if (boqRows.length !== boqIds.length) {
      throw new Error("חלק מסעיפי כתב הכמויות לא נמצאו בפרויקט");
    }

    const boqById = new Map(boqRows.map((b) => [b.id, b]));

    for (const line of input.items) {
      const boq = boqById.get(line.boqItemId)!;
      const invoiced = Number(boq.invoicedQuantity);
      const available =
        input.quantitySource === "measurement"
          ? Math.max(0, Number(boq.contractQuantity) - invoiced)
          : availableForInvoice(Number(boq.completedQuantity), invoiced);
      const qty = Number(line.quantity);
      if (!(qty > 0)) {
        throw new Error(`כמות לא תקינה לסעיף ${boq.code}`);
      }
      if (qty > available + 1e-9) {
        throw new Error(
          `לא ניתן לחייב כפול בסעיף ${boq.code}: זמין ${available}, בוקש ${qty}`
        );
      }
    }

    const sequenceNumber = await this.nextSequence(input.projectId);
    const invoiceDate = input.date ? new Date(input.date) : new Date();
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const billingMonth =
      input.billingMonth?.trim() || formatBillingMonth(invoiceDate);
    const invoiceNumber = `${project.contractNumber}-חשבון-${sequenceNumber}`;

    const lineData = input.items.map((line) => {
      const boq = boqById.get(line.boqItemId)!;
      const contractQuantity = Number(boq.contractQuantity);
      const previousQuantity = Number(boq.invoicedQuantity);
      const currentQuantity = Number(line.quantity);
      const unitPrice = Number(boq.unitPrice);
      const calc = computeInvoiceLine({
        contractQuantity,
        previousQuantity,
        currentQuantity,
        unitPrice,
      });

      return {
        boqItemId: boq.id,
        code: boq.code,
        description: cleanBoqDescription(boq.description) || boq.description,
        unit: boq.unit,
        contractQuantity,
        previousQuantity,
        quantity: currentQuantity,
        cumulativeQuantity: calc.cumulativeQuantity,
        quantityPercent: calc.quantityPercent,
        unitPrice,
        total: calc.currentAmount,
        cumulativeAmount: calc.cumulativeAmount,
        financialPercent: calc.financialPercent,
      };
    });

    const amount = lineData.reduce((s, l) => s + l.total, 0);

    // Prefer project document VAT fields — do not invent if missing
    const vatPercent =
      project.vatPercent != null ? Number(project.vatPercent) : null;
    let subtotal: number | null =
      project.subtotal != null ? Number(project.subtotal) : null;
    let vatAmount: number | null =
      project.vatAmount != null ? Number(project.vatAmount) : null;
    let totalWithVat: number | null =
      project.totalWithVat != null ? Number(project.totalWithVat) : null;

    // For this invoice only: if project has vatPercent from contract, apply to amount
    // without inventing when percent itself is missing
    if (vatPercent != null && Number.isFinite(vatPercent)) {
      subtotal = amount;
      vatAmount = Math.round(amount * (vatPercent / 100) * 100) / 100;
      totalWithVat = Math.round((amount + vatAmount) * 100) / 100;
    } else {
      subtotal = amount;
      totalWithVat = amount;
    }

    const contractValue = Number(project.contractValue) || 0;
    const invoicedValue =
      (Number(project.invoicedValue) || 0) + amount;
    const financialProgress =
      contractValue > 0
        ? Math.round((invoicedValue / contractValue) * 1000) / 10
        : 0;

    const boqItemIds = lineData.map((l) => l.boqItemId);
    const reportWhere = {
      invoiced: false as const,
      boqItemId: { in: boqItemIds },
      report: {
        projectId: input.projectId,
        status: "submitted" as const,
        ...(input.reportIds && input.reportIds.length > 0
          ? { id: { in: input.reportIds } }
          : {}),
      },
    };

    const created = await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.partialInvoice.create({
          data: {
            projectId: input.projectId,
            invoiceNumber,
            sequenceNumber,
            billingMonth,
            billTo: input.billTo?.trim() || null,
            contractor:
              input.contractor?.trim() || project.contractor || null,
            amount,
            subtotal,
            vatPercent,
            vatAmount,
            totalWithVat,
            status: input.status ?? "draft",
            date: invoiceDate,
            dueDate,
            notes: input.notes?.trim() || null,
            ownerId: userId,
            createdById: userId,
            updatedById: userId,
            items: {
              create: lineData,
            },
          },
          include: this.invoiceInclude,
        });

        await Promise.all(
          lineData.map((line) => {
            const boq = boqById.get(line.boqItemId)!;
            return tx.boqItem.update({
              where: { id: line.boqItemId },
              data: {
                invoicedQuantity:
                  Number(boq.invoicedQuantity) + Number(line.quantity),
                updatedById: userId,
              },
            });
          })
        );

        await tx.executionReportItem.updateMany({
          where: reportWhere,
          data: {
            invoiced: true,
            invoicedAt: new Date(),
            invoiceId: invoice.id,
          },
        });

        await tx.project.update({
          where: { id: input.projectId },
          data: {
            invoicedValue,
            financialProgress,
            updatedById: userId,
          },
        });

        return invoice;
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    // Non-critical side effects — outside the transaction so they never kill the commit
    void prisma.activity
      .create({
        data: {
          projectId: input.projectId,
          type: "invoice_created",
          title: `נוצר חשבון ${sequenceNumber}`,
          description: `חשבון חלקי לחודש ${billingMonth} בסך ${amount.toLocaleString("he-IL")} ₪`,
          userId,
          metadata: JSON.stringify({
            invoiceId: created.id,
            sequenceNumber,
            amount,
          }),
        },
      })
      .catch((err) =>
        console.error("[PartialInvoicesRepository.create] activity log failed", err)
      );

    await AuditRepository.log({
      action: "CREATE",
      entityType: "PartialInvoice",
      entityId: created.id,
      userId,
      metadata: {
        projectId: input.projectId,
        sequenceNumber,
        billingMonth,
        amount,
        itemCount: lineData.length,
      },
    });

    return mapPartialInvoice(created);
  }

  /**
   * Update invoice content without changing invoiceNumber / sequenceNumber / projectId.
   * Reverses old BOQ invoiced qty, applies new lines, recomputes totals + project financials.
   */
  static async update(
    id: string,
    input: UpdatePartialInvoiceInput,
    userId: string
  ) {
    if (!input.items?.length) {
      throw new Error("יש להוסיף לפחות סעיף אחד לחשבון");
    }

    const existing = await prisma.partialInvoice.findUnique({
      where: { id },
      include: { items: true, project: true },
    });
    if (!existing) throw new Error("חשבון לא נמצא");

    // Content edits are only legal in editable statuses. Status transitions
    // themselves go through the approval / sign endpoints — never PATCH.
    assertDocumentMutable(String(existing.status), {
      allowStatuses: INVOICE_EDITABLE_STATUSES,
      entityLabel: "החשבון",
    });

    const projectId = existing.projectId;
    const project = existing.project;

    const boqIds = [...new Set(input.items.map((i) => i.boqItemId))];
    const boqRows = await prisma.boqItem.findMany({
      where: { id: { in: boqIds }, projectId, deletedAt: null },
    });
    if (boqRows.length !== boqIds.length) {
      throw new Error("חלק מסעיפי כתב הכמויות לא נמצאו בפרויקט");
    }
    const boqById = new Map(boqRows.map((b) => [b.id, b]));

    const oldQtyByBoq = new Map<string, number>();
    for (const item of existing.items) {
      oldQtyByBoq.set(
        item.boqItemId,
        (oldQtyByBoq.get(item.boqItemId) ?? 0) + Number(item.quantity)
      );
    }

    // Validate availability as if this invoice's old quantities were released
    for (const line of input.items) {
      const boq = boqById.get(line.boqItemId)!;
      const executed = Number(boq.completedQuantity);
      const invoiced = Number(boq.invoicedQuantity);
      const released = oldQtyByBoq.get(line.boqItemId) ?? 0;
      const available = availableForInvoice(executed, invoiced - released);
      const qty = Number(line.quantity);
      if (!(qty > 0)) {
        throw new Error(`כמות לא תקינה לסעיף ${boq.code}`);
      }
      if (qty > available + 1e-9) {
        throw new Error(
          `לא ניתן לחייב כפול בסעיף ${boq.code}: זמין ${available}, בוקש ${qty}`
        );
      }
    }

    const invoiceDate = input.date ? new Date(input.date) : existing.date;
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : existing.dueDate;
    const billingMonth =
      input.billingMonth?.trim() ||
      existing.billingMonth ||
      formatBillingMonth(invoiceDate);

    const beforeSnapshot = {
      date: existing.date.toISOString().slice(0, 10),
      billingMonth: existing.billingMonth,
      billTo: existing.billTo,
      contractor: existing.contractor,
      notes: existing.notes,
      status: existing.status,
      amount: Number(existing.amount),
      itemCount: existing.items.length,
      items: existing.items.map((i) => ({
        boqItemId: i.boqItemId,
        code: i.code,
        description: i.description,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      })),
    };

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Reverse old invoiced quantities
      for (const [boqItemId, qty] of oldQtyByBoq) {
        const boq = await tx.boqItem.findUnique({ where: { id: boqItemId } });
        if (!boq) continue;
        await tx.boqItem.update({
          where: { id: boqItemId },
          data: {
            invoicedQuantity: Math.max(0, Number(boq.invoicedQuantity) - qty),
            updatedById: userId,
          },
        });
      }

      // Reload BOQ after reverse for previousQuantity snapshots
      const freshBoq = await tx.boqItem.findMany({
        where: { id: { in: boqIds }, projectId },
      });
      const freshById = new Map(freshBoq.map((b) => [b.id, b]));

      const lineData = input.items.map((line) => {
        const boq = freshById.get(line.boqItemId)!;
        const contractQuantity = Number(boq.contractQuantity);
        const previousQuantity = Number(boq.invoicedQuantity);
        const currentQuantity = Number(line.quantity);
        const unitPrice =
          line.unitPrice != null && Number.isFinite(Number(line.unitPrice))
            ? Number(line.unitPrice)
            : Number(boq.unitPrice);
        const calc = computeInvoiceLine({
          contractQuantity,
          previousQuantity,
          currentQuantity,
          unitPrice,
        });

        return {
          boqItemId: boq.id,
          code: boq.code,
          description:
            line.description?.trim() ||
            cleanBoqDescription(boq.description) ||
            boq.description,
          unit: line.unit?.trim() || boq.unit,
          contractQuantity,
          previousQuantity,
          quantity: currentQuantity,
          cumulativeQuantity: calc.cumulativeQuantity,
          quantityPercent: calc.quantityPercent,
          unitPrice,
          total: calc.currentAmount,
          cumulativeAmount: calc.cumulativeAmount,
          financialPercent: calc.financialPercent,
        };
      });

      const amount = lineData.reduce((s, l) => s + l.total, 0);
      const vatPercent =
        project.vatPercent != null ? Number(project.vatPercent) : null;
      let subtotal: number | null = amount;
      let vatAmount: number | null = null;
      let totalWithVat: number | null = amount;
      if (vatPercent != null && Number.isFinite(vatPercent)) {
        vatAmount = Math.round(amount * (vatPercent / 100) * 100) / 100;
        totalWithVat = Math.round((amount + vatAmount) * 100) / 100;
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const invoice = await tx.partialInvoice.update({
        where: { id },
        data: {
          // invoiceNumber + sequenceNumber + projectId unchanged
          billingMonth,
          billTo:
            input.billTo !== undefined
              ? input.billTo.trim() || null
              : existing.billTo,
          contractor:
            input.contractor !== undefined
              ? input.contractor.trim() || null
              : existing.contractor,
          amount,
          subtotal,
          vatPercent,
          vatAmount,
          totalWithVat,
          // status is intentionally NOT taken from input — status changes must
          // go through approval / send / sign endpoints so workflow gates hold.
          status: existing.status,
          date: invoiceDate,
          dueDate,
          notes:
            input.notes !== undefined
              ? input.notes.trim() || null
              : existing.notes,
          updatedById: userId,
          items: { create: lineData },
        },
        include: this.invoiceInclude,
      });

      for (const line of lineData) {
        const boq = freshById.get(line.boqItemId)!;
        await tx.boqItem.update({
          where: { id: line.boqItemId },
          data: {
            invoicedQuantity:
              Number(boq.invoicedQuantity) + Number(line.quantity),
            updatedById: userId,
          },
        });
      }

      const allBoq = await tx.boqItem.findMany({ where: { projectId } });
      const invoicedValue = allBoq.reduce(
        (sum, item) =>
          sum + Number(item.invoicedQuantity) * Number(item.unitPrice),
        0
      );
      const contractValue = Number(project.contractValue) || 0;
      const financialProgress =
        contractValue > 0
          ? Math.round((invoicedValue / contractValue) * 1000) / 10
          : 0;

      await tx.project.update({
        where: { id: projectId },
        data: {
          invoicedValue,
          financialProgress,
          updatedById: userId,
        },
      });

      await tx.activity.create({
        data: {
          projectId,
          type: "invoice_created",
          title: `עודכן חשבון ${existing.sequenceNumber}`,
          description: `חשבון ${existing.invoiceNumber} עודכן · סכום ${amount.toLocaleString("he-IL")} ₪`,
          userId,
          metadata: JSON.stringify({
            invoiceId: id,
            sequenceNumber: existing.sequenceNumber,
            amount,
            action: "update",
          }),
        },
      });

      return invoice;
    });

    const afterSnapshot = {
      date: updated.date.toISOString().slice(0, 10),
      billingMonth: updated.billingMonth,
      billTo: updated.billTo,
      contractor: updated.contractor,
      notes: updated.notes,
      status: updated.status,
      amount: Number(updated.amount),
      itemCount: updated.items.length,
      items: updated.items.map((i) => ({
        boqItemId: i.boqItemId,
        code: i.code,
        description: i.description,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      })),
    };

    const changedFields: string[] = [];
    for (const key of Object.keys(beforeSnapshot) as (keyof typeof beforeSnapshot)[]) {
      if (key === "items") {
        if (JSON.stringify(beforeSnapshot.items) !== JSON.stringify(afterSnapshot.items)) {
          changedFields.push("items");
        }
        continue;
      }
      if (String(beforeSnapshot[key] ?? "") !== String(afterSnapshot[key] ?? "")) {
        changedFields.push(key);
      }
    }

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "PartialInvoice",
      entityId: id,
      userId,
      metadata: {
        invoiceNumber: existing.invoiceNumber,
        sequenceNumber: existing.sequenceNumber,
        changedFields,
        before: beforeSnapshot,
        after: afterSnapshot,
      },
    });

    return mapPartialInvoice(updated);
  }
}
