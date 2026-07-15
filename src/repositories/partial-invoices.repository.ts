import { prisma } from "@/lib/prisma";
import { mapPartialInvoice } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import {
  availableForInvoice,
  computeInvoiceLine,
  formatBillingMonth,
} from "@/utils/invoice-calc";
import { cleanBoqDescription } from "@/utils/boq-text";

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

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });
    if (!project) throw new Error("פרויקט לא נמצא");

    const boqIds = input.items.map((i) => i.boqItemId);
    const boqRows = await prisma.boqItem.findMany({
      where: { id: { in: boqIds }, projectId: input.projectId },
    });
    if (boqRows.length !== boqIds.length) {
      throw new Error("חלק מסעיפי כתב הכמויות לא נמצאו בפרויקט");
    }

    const boqById = new Map(boqRows.map((b) => [b.id, b]));

    for (const line of input.items) {
      const boq = boqById.get(line.boqItemId)!;
      const executed = Number(boq.completedQuantity);
      const invoiced = Number(boq.invoicedQuantity);
      const available = availableForInvoice(executed, invoiced);
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

    const created = await prisma.$transaction(async (tx) => {
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
          // New invoices stay draft until office sends to foreman approval
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

      for (const line of lineData) {
        const boq = boqById.get(line.boqItemId)!;
        const nextInvoiced =
          Number(boq.invoicedQuantity) + Number(line.quantity);
        await tx.boqItem.update({
          where: { id: line.boqItemId },
          data: {
            invoicedQuantity: nextInvoiced,
            updatedById: userId,
          },
        });
      }

      const allBoq = await tx.boqItem.findMany({
        where: { projectId: input.projectId },
      });
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
        where: { id: input.projectId },
        data: {
          invoicedValue,
          financialProgress,
          updatedById: userId,
        },
      });

      await tx.activity.create({
        data: {
          projectId: input.projectId,
          type: "invoice_created",
          title: `נוצר חשבון ${sequenceNumber}`,
          description: `חשבון חלקי לחודש ${billingMonth} בסך ${amount.toLocaleString("he-IL")} ₪`,
          userId,
          metadata: JSON.stringify({
            invoiceId: invoice.id,
            sequenceNumber,
            amount,
          }),
        },
      });

      return invoice;
    });

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
}
