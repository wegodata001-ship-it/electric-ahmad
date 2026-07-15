import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { emitDomainEvent } from "@/lib/events/domain-events";
import type { InvoiceStatus } from "@prisma/client";

const SENDABLE: InvoiceStatus[] = [
  "draft",
  "rejected_by_foreman",
  // legacy re-submit paths
  "rejected",
];

function mapApproval(row: {
  id: string;
  invoiceId: string;
  projectId: string;
  managerId: string;
  status: string;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  comment: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  manager?: { firstName: string; lastName: string };
  invoice?: { sequenceNumber: number; invoiceNumber: string; amount: unknown };
}) {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    projectId: row.projectId,
    managerId: row.managerId,
    managerName: row.manager
      ? `${row.manager.firstName} ${row.manager.lastName}`
      : undefined,
    status: row.status as "pending" | "approved" | "rejected" | "cancelled",
    sentAt: row.sentAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    comment: row.comment,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    invoiceSequence: row.invoice?.sequenceNumber,
    invoiceNumber: row.invoice?.invoiceNumber,
    amount: row.invoice ? Number(row.invoice.amount) : undefined,
  };
}

export class InvoiceApprovalsRepository {
  static async findByInvoice(invoiceId: string) {
    const rows = await prisma.projectInvoiceApproval.findMany({
      where: { invoiceId },
      include: {
        manager: { select: { firstName: true, lastName: true } },
        invoice: {
          select: { sequenceNumber: true, invoiceNumber: true, amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapApproval);
  }

  static async findPendingForManager(managerId: string) {
    const rows = await prisma.projectInvoiceApproval.findMany({
      where: { managerId, status: "pending" },
      include: {
        manager: { select: { firstName: true, lastName: true } },
        invoice: {
          select: { sequenceNumber: true, invoiceNumber: true, amount: true },
        },
      },
      orderBy: { sentAt: "desc" },
    });
    return rows.map(mapApproval);
  }

  /**
   * Office action: send invoice to project foreman for approval.
   * Creates Approval row only — no email / WhatsApp / push.
   */
  static async sendForApproval(invoiceId: string, userId: string) {
    const invoice = await prisma.partialInvoice.findUnique({
      where: { id: invoiceId },
      include: { project: { select: { id: true, foremanId: true } } },
    });
    if (!invoice) throw new Error("חשבון לא נמצא");

    if (!SENDABLE.includes(invoice.status)) {
      throw new Error(
        "ניתן לשלוח לאישור רק חשבון בטיוטה או שנדחה על ידי מנהל עבודה"
      );
    }

    const managerId = invoice.project.foremanId;
    if (!managerId) {
      throw new Error("לפרויקט לא משויך מנהל עבודה");
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Cancel any previous pending approvals for this invoice
      await tx.projectInvoiceApproval.updateMany({
        where: { invoiceId, status: "pending" },
        data: { status: "cancelled", updatedAt: now },
      });

      const approval = await tx.projectInvoiceApproval.create({
        data: {
          invoiceId,
          projectId: invoice.projectId,
          managerId,
          status: "pending",
          sentAt: now,
          createdById: userId,
        },
        include: {
          manager: { select: { firstName: true, lastName: true } },
          invoice: {
            select: { sequenceNumber: true, invoiceNumber: true, amount: true },
          },
        },
      });

      await tx.partialInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "pending_foreman_approval",
          updatedById: userId,
        },
      });

      await tx.activity.create({
        data: {
          projectId: invoice.projectId,
          type: "status_changed",
          title: "חשבון נשלח לאישור מנהל עבודה",
          description: `חשבון ${invoice.sequenceNumber} ממתין לאישור מנהל העבודה`,
          userId,
          metadata: JSON.stringify({
            invoiceId,
            approvalId: approval.id,
            managerId,
          }),
        },
      });

      return approval;
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "ProjectInvoiceApproval",
      entityId: result.id,
      userId,
      metadata: {
        action: "send_for_approval",
        invoiceId,
        managerId,
      },
    });

    emitDomainEvent("invoice.sent_for_foreman_approval", {
      invoiceId,
      projectId: invoice.projectId,
      approvalId: result.id,
      managerId,
      sequenceNumber: invoice.sequenceNumber,
      amount: Number(invoice.amount),
      actorUserId: userId,
    });

    return mapApproval(result);
  }

  /**
   * Future manager workspace action — no UI yet.
   */
  static async approve(approvalId: string, actorUserId: string, comment?: string) {
    const approval = await prisma.projectInvoiceApproval.findUnique({
      where: { id: approvalId },
      include: { invoice: true },
    });
    if (!approval) throw new Error("בקשת אישור לא נמצאה");
    if (approval.status !== "pending") {
      throw new Error("ניתן לאשר רק בקשה במצב ממתין");
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectInvoiceApproval.update({
        where: { id: approvalId },
        data: {
          status: "approved",
          approvedAt: now,
          comment: comment?.trim() || approval.comment,
        },
        include: {
          manager: { select: { firstName: true, lastName: true } },
          invoice: {
            select: { sequenceNumber: true, invoiceNumber: true, amount: true },
          },
        },
      });

      await tx.partialInvoice.update({
        where: { id: approval.invoiceId },
        data: {
          status: "approved_by_foreman",
          updatedById: actorUserId,
        },
      });

      await tx.activity.create({
        data: {
          projectId: approval.projectId,
          type: "status_changed",
          title: "חשבון אושר על ידי מנהל עבודה",
          description: `חשבון ${approval.invoice.sequenceNumber} אושר`,
          userId: actorUserId,
          metadata: JSON.stringify({ approvalId, invoiceId: approval.invoiceId }),
        },
      });

      return row;
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "ProjectInvoiceApproval",
      entityId: approvalId,
      userId: actorUserId,
      metadata: { action: "approve", invoiceId: approval.invoiceId },
    });

    emitDomainEvent("invoice.approved_by_foreman", {
      invoiceId: approval.invoiceId,
      projectId: approval.projectId,
      approvalId,
      managerId: approval.managerId,
      sequenceNumber: approval.invoice.sequenceNumber,
      amount: Number(approval.invoice.amount),
      comment: comment ?? null,
      actorUserId,
    });

    return mapApproval(updated);
  }

  /**
   * Future manager workspace action — no UI yet.
   */
  static async reject(
    approvalId: string,
    actorUserId: string,
    comment: string
  ) {
    if (!comment?.trim()) {
      throw new Error("חובה לכתוב הערה בעת דחייה");
    }

    const approval = await prisma.projectInvoiceApproval.findUnique({
      where: { id: approvalId },
      include: { invoice: true },
    });
    if (!approval) throw new Error("בקשת אישור לא נמצאה");
    if (approval.status !== "pending") {
      throw new Error("ניתן לדחות רק בקשה במצב ממתין");
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectInvoiceApproval.update({
        where: { id: approvalId },
        data: {
          status: "rejected",
          rejectedAt: now,
          comment: comment.trim(),
        },
        include: {
          manager: { select: { firstName: true, lastName: true } },
          invoice: {
            select: { sequenceNumber: true, invoiceNumber: true, amount: true },
          },
        },
      });

      await tx.partialInvoice.update({
        where: { id: approval.invoiceId },
        data: {
          status: "rejected_by_foreman",
          updatedById: actorUserId,
        },
      });

      await tx.activity.create({
        data: {
          projectId: approval.projectId,
          type: "status_changed",
          title: "חשבון נדחה על ידי מנהל עבודה",
          description: comment.trim(),
          userId: actorUserId,
          metadata: JSON.stringify({ approvalId, invoiceId: approval.invoiceId }),
        },
      });

      return row;
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "ProjectInvoiceApproval",
      entityId: approvalId,
      userId: actorUserId,
      metadata: {
        action: "reject",
        invoiceId: approval.invoiceId,
        comment: comment.trim(),
      },
    });

    emitDomainEvent("invoice.rejected_by_foreman", {
      invoiceId: approval.invoiceId,
      projectId: approval.projectId,
      approvalId,
      managerId: approval.managerId,
      sequenceNumber: approval.invoice.sequenceNumber,
      amount: Number(approval.invoice.amount),
      comment: comment.trim(),
      actorUserId,
    });

    return mapApproval(updated);
  }

  /** Office action after foreman approval — prepare for client send (no channel yet). */
  static async markSentToClient(invoiceId: string, userId: string) {
    const invoice = await prisma.partialInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new Error("חשבון לא נמצא");
    if (invoice.status !== "approved_by_foreman") {
      throw new Error("ניתן לסמן כנשלח ללקוח רק לאחר אישור מנהל עבודה");
    }

    await prisma.partialInvoice.update({
      where: { id: invoiceId },
      data: { status: "sent_to_client", updatedById: userId },
    });

    emitDomainEvent("invoice.sent_to_client", {
      invoiceId,
      projectId: invoice.projectId,
      sequenceNumber: invoice.sequenceNumber,
      amount: Number(invoice.amount),
      actorUserId: userId,
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "PartialInvoice",
      entityId: invoiceId,
      userId,
      metadata: { action: "sent_to_client" },
    });

    return true;
  }
}
