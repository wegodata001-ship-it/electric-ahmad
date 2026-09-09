import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { DocumentsRepository } from "./documents.repository";
import { emitDomainEvent } from "@/lib/events/domain-events";
import {
  canApproveDocuments,
  isSystemAdminRole,
  roleGradeLabel,
} from "@/lib/auth/document-permissions";
import {
  canSendFinancialToClient,
  SEND_TO_CLIENT_FORBIDDEN_MESSAGE,
} from "@/lib/auth/financial-permissions";
import { FIELD_MANAGER_ROLE } from "@/lib/auth/roles";
import type { InvoiceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

const SENDABLE: InvoiceStatus[] = [
  "draft",
  "rejected_by_foreman",
  "rejected",
];

const APPROVER_ROLE_FILTER = [
  { role: "ADMIN" },
  { role: "admin" },
  { role: "מנהל מערכת" },
  { role: "SYSTEM_MANAGER" },
  { role: "PROJECT_MANAGER" },
  { role: "OPERATIONS_MANAGER" },
];

const MEASUREMENT_APPROVER_ROLE_FILTER = [
  ...APPROVER_ROLE_FILTER,
  { role: FIELD_MANAGER_ROLE },
];

export type SendForApprovalOptions = {
  /** Single approver (legacy) */
  approverUserId?: string;
  /** One or more approvers */
  approverUserIds?: string[];
  createTask?: boolean;
  notifyInApp?: boolean;
  sendWhatsApp?: boolean;
  sendEmail?: boolean;
};

export class ApprovalSendError extends Error {
  constructor(
    public readonly code:
      | "APPROVAL_SAVE_FAILED"
      | "APPROVAL_ALREADY_PENDING"
      | "APPROVER_VALIDATION_FAILED",
    message: string
  ) {
    super(message);
    this.name = "ApprovalSendError";
  }
}

export class ApprovalDecisionError extends Error {
  constructor(
    message: string,
    readonly status = 403
  ) {
    super(message);
    this.name = "ApprovalDecisionError";
  }
}

function departmentForRole(role?: string | null): string {
  const label = roleGradeLabel(role);
  if (label === "מנהל מערכת") return "הנהלה";
  if (label === "מנהל תפעול") return "תפעול";
  if (label === "מנהל פרויקט") return "פרויקטים";
  if (label === "מנהל עבודה") return "שטח";
  return "משרד";
}

function mapApproval(row: {
  id: string;
  invoiceId: string;
  projectId: string;
  managerId: string | null;
  approverUserId?: string | null;
  status: string;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  comment: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  manager?: { firstName: string; lastName: string } | null;
  approverUser?: { id: string; name: string; email: string; role: string } | null;
  createdBy?: { id: string; name: string } | null;
  invoice?: { sequenceNumber: number; invoiceNumber: string; amount: unknown };
}) {
  const managerName = row.approverUser?.name
    ? row.approverUser.name
    : row.manager
      ? `${row.manager.firstName} ${row.manager.lastName}`
      : undefined;

  return {
    id: row.id,
    invoiceId: row.invoiceId,
    projectId: row.projectId,
    managerId: row.managerId ?? "",
    approverUserId: row.approverUserId ?? null,
    managerName,
    senderName: row.createdBy?.name,
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

const approvalInclude = {
  manager: { select: { firstName: true, lastName: true } },
  approverUser: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  invoice: {
    select: { sequenceNumber: true, invoiceNumber: true, amount: true },
  },
} as const;

export class InvoiceApprovalsRepository {
  /**
   * @param opts.includeFieldManagers — for measurement sheets: also list מנהלי עבודה
   */
  static async listApprovers(opts?: { includeFieldManagers?: boolean }) {
    const roleFilter = opts?.includeFieldManagers
      ? MEASUREMENT_APPROVER_ROLE_FILTER
      : APPROVER_ROLE_FILTER;

    const users = await prisma.user.findMany({
      where: {
        passwordHash: { not: null },
        OR: roleFilter,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            id: true,
            phone: true,
            email: true,
            status: true,
            role: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const eligible = users.filter(
      (u) =>
        canApproveDocuments(u.role) ||
        (opts?.includeFieldManagers && u.role === FIELD_MANAGER_ROLE)
    );
    const userIds = eligible.map((u) => u.id);
    const employeeIds = eligible
      .map((u) => u.employee?.id)
      .filter((id): id is string => Boolean(id));

    const [pendingByUser, pendingByEmployee] = await Promise.all([
      prisma.projectInvoiceApproval.groupBy({
        by: ["approverUserId"],
        where: {
          status: "pending",
          approverUserId: { in: userIds },
        },
        _count: { _all: true },
      }),
      employeeIds.length
        ? prisma.projectInvoiceApproval.groupBy({
            by: ["managerId"],
            where: {
              status: "pending",
              managerId: { in: employeeIds },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const pendingUserMap = new Map(
      pendingByUser
        .filter((r) => r.approverUserId)
        .map((r) => [r.approverUserId!, r._count._all])
    );
    const pendingEmpMap = new Map(
      pendingByEmployee
        .filter((r) => r.managerId)
        .map((r) => [r.managerId!, r._count._all])
    );

    return eligible.map((u) => {
      const emp = u.employee;
      const roleLabel = roleGradeLabel(u.role);
      const pendingCount =
        (pendingUserMap.get(u.id) ?? 0) +
        (emp?.id ? pendingEmpMap.get(emp.id) ?? 0 : 0);
      const active =
        emp && !emp.isDeleted
          ? emp.status === "active"
          : Boolean(u.email);

      return {
        id: u.id,
        fullName: u.name,
        role: u.role,
        roleLabel,
        department: departmentForRole(u.role),
        phone: emp?.phone ?? "",
        email: emp?.email || u.email,
        status: active ? ("active" as const) : ("inactive" as const),
        statusLabel: active ? "פעיל" : "לא פעיל",
        pendingApprovals: pendingCount,
        employeeId: emp?.id ?? null,
      };
    });
  }

  static async findByInvoice(invoiceId: string) {
    const rows = await prisma.projectInvoiceApproval.findMany({
      where: { invoiceId },
      include: approvalInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapApproval);
  }

  static async findPendingForManager(managerId: string) {
    const rows = await prisma.projectInvoiceApproval.findMany({
      where: {
        status: "pending",
        OR: [{ managerId }, { approverUserId: managerId }],
      },
      include: approvalInclude,
      orderBy: { sentAt: "desc" },
    });
    return rows.map(mapApproval);
  }

  /**
   * Office action: send invoice to one or more selected approver users.
   */
  static async sendForApproval(
    invoiceId: string,
    userId: string,
    options: SendForApprovalOptions,
    scheduleAfterResponse?: (task: () => Promise<void>) => void
  ) {
    const startedAt = performance.now();
    const ids = [
      ...new Set(
        [
          ...(options.approverUserIds ?? []),
          ...(options.approverUserId ? [options.approverUserId] : []),
        ]
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];
    if (!ids.length) {
      throw new ApprovalSendError(
        "APPROVER_VALIDATION_FAILED",
        "יש לבחור מנהל לאישור החשבון"
      );
    }

    const validationStartedAt = performance.now();
    const [invoice, approverRows] = await Promise.all([
      prisma.partialInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          projectId: true,
          invoiceNumber: true,
          sequenceNumber: true,
          amount: true,
          status: true,
          project: { select: { id: true, name: true, foremanId: true } },
        },
      }),
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          employee: {
            select: { id: true, phone: true, email: true, isDeleted: true },
          },
        },
      }),
    ]);
    if (!invoice) throw new Error("חשבון לא נמצא");

    if (
      !SENDABLE.includes(invoice.status) &&
      invoice.status !== "pending_foreman_approval"
    ) {
      throw new ApprovalSendError(
        "APPROVAL_SAVE_FAILED",
        "ניתן לשלוח לאישור רק חשבון בטיוטה או שנדחה על ידי מנהל עבודה"
      );
    }

    if (approverRows.length !== ids.length) {
      throw new ApprovalSendError(
        "APPROVER_VALIDATION_FAILED",
        "אחד או יותר מהמנהלים שנבחרו לא נמצאו"
      );
    }
    const approverById = new Map(approverRows.map((row) => [row.id, row]));
    const approvers = ids.map((id) => approverById.get(id)!);
    for (const a of approvers) {
      if (!canApproveDocuments(a.role)) {
        throw new ApprovalSendError(
          "APPROVER_VALIDATION_FAILED",
          `המשתמש ${a.name} אינו מורשה לאשר חשבונות`
        );
      }
    }
    const validationMs = performance.now() - validationStartedAt;

    const now = new Date();
    const createTask = options.createTask !== false;
    const notifyInApp = options.notifyInApp !== false;
    const sendWhatsApp = Boolean(options.sendWhatsApp);
    const sendEmail = Boolean(options.sendEmail);
    const requestedApprovals = approvers.map((approver) => ({
      id: randomUUID(),
      invoiceId,
      projectId: invoice.projectId,
      managerId:
        approver.employee && !approver.employee.isDeleted
          ? approver.employee.id
          : null,
      approverUserId: approver.id,
      status: "pending" as const,
      sentAt: now,
      approvedAt: null,
      rejectedAt: null,
      comment: null,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    }));

    const transactionStartedAt = performance.now();
    const core = await prisma.$transaction(async (tx) => {
      // Atomic claim: only one request may move this invoice into a pending
      // cycle. A concurrent retry observes the committed pending approvals.
      const claimed = await tx.partialInvoice.updateMany({
        where: { id: invoiceId, status: { in: SENDABLE } },
        data: {
          status: "pending_foreman_approval",
          updatedById: userId,
        },
      });

      if (claimed.count === 0) {
        const existing = await tx.projectInvoiceApproval.findMany({
          where: { invoiceId, status: "pending" },
          orderBy: { createdAt: "asc" },
        });
        const existingIds = existing
          .map((row) => row.approverUserId)
          .filter((id): id is string => Boolean(id))
          .sort();
        const requestedIds = [...ids].sort();
        if (
          existingIds.length === requestedIds.length &&
          existingIds.every((id, index) => id === requestedIds[index])
        ) {
          return { approvals: existing, idempotent: true };
        }
        throw new ApprovalSendError(
          "APPROVAL_ALREADY_PENDING",
          "החשבון כבר נשלח למחזור אישור אחר"
        );
      }

      await tx.projectInvoiceApproval.updateMany({
        where: { invoiceId, status: "pending" },
        data: { status: "cancelled", updatedAt: now },
      });
      await tx.projectInvoiceApproval.createMany({
        data: requestedApprovals.map((approval) => ({
          id: approval.id,
          invoiceId: approval.invoiceId,
          projectId: approval.projectId,
          managerId: approval.managerId,
          approverUserId: approval.approverUserId,
          status: approval.status,
          sentAt: approval.sentAt,
          approvedAt: approval.approvedAt,
          rejectedAt: approval.rejectedAt,
          comment: approval.comment,
          createdById: approval.createdById,
        })),
      });

      return { approvals: requestedApprovals, idempotent: false };
    });
    const transactionMs = performance.now() - transactionStartedAt;

    const first = approvers[0]!;
    const phone = (first.employee?.phone || "").replace(/\D/g, "");
    const email = first.employee?.email || first.email;
    const names = approvers.map((a) => a.name).join(", ");
    const message = encodeURIComponent(
      `שלום,\nחשבון ${invoice.invoiceNumber} בפרויקט ${invoice.project.name} ממתין לאישור (${names}) במערכת.`
    );

    const approvalDtos = core.approvals.map((approval) => {
      const approver = approverById.get(approval.approverUserId || "");
      return {
        id: approval.id,
        invoiceId,
        projectId: invoice.projectId,
        managerId: approval.managerId ?? "",
        approverUserId: approval.approverUserId,
        managerName: approver?.name,
        status: "pending" as const,
        sentAt: approval.sentAt?.toISOString() ?? now.toISOString(),
        approvedAt: null,
        rejectedAt: null,
        comment: approval.comment,
        createdById: userId,
        createdAt: approval.createdAt.toISOString(),
        updatedAt: approval.updatedAt.toISOString(),
        invoiceSequence: invoice.sequenceNumber,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
      };
    });

    if (!core.idempotent) {
      const task = () =>
        this.runSendForApprovalSideEffects({
          invoice,
          approvals: requestedApprovals,
          approvers,
          actorUserId: userId,
          createTask,
          notifyInApp,
          sendWhatsApp,
          sendEmail,
        });
      if (scheduleAfterResponse) scheduleAfterResponse(task);
      else void task();
    }

    const totalMs = performance.now() - startedAt;

    return {
      approval: approvalDtos[0]!,
      approvals: approvalDtos,
      idempotent: core.idempotent,
      channels: {
        whatsappUrl:
          sendWhatsApp && phone
            ? `https://wa.me/${phone.startsWith("972") ? phone : phone.replace(/^0/, "972")}?text=${message}`
            : null,
        emailUrl:
          sendEmail && email
            ? `mailto:${email}?subject=${encodeURIComponent(`אישור חשבון ${invoice.invoiceNumber}`)}&body=${message}`
            : null,
      },
      performance: {
        validationMs: Math.round(validationMs),
        transactionMs: Math.round(transactionMs),
        totalMs: Math.round(totalMs),
      },
    };
  }

  private static async runSendForApprovalSideEffects(input: {
    invoice: {
      id: string;
      projectId: string;
      invoiceNumber: string;
      sequenceNumber: number;
      amount: unknown;
      project: { name: string };
    };
    approvals: {
      id: string;
      managerId: string | null;
      approverUserId: string | null;
    }[];
    approvers: {
      id: string;
      name: string;
    }[];
    actorUserId: string;
    createTask: boolean;
    notifyInApp: boolean;
    sendWhatsApp: boolean;
    sendEmail: boolean;
  }) {
    const startedAt = performance.now();
    const failures: { stage: string; error: string }[] = [];
    const run = async (stage: string, operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown side-effect error";
        failures.push({ stage, error: message });
        console.error(`[send-for-approval] ${stage} failed`, error);
      }
    };

    if (input.createTask) {
      await run("TASK_NOTIFICATION_FAILED", () =>
        prisma.activity.createMany({
          data: input.approvals.map((approval) => {
            const approver = input.approvers.find(
              (candidate) => candidate.id === approval.approverUserId
            )!;
            return {
              projectId: input.invoice.projectId,
              type: "status_changed",
              title: "משימת אישור חשבון",
              description: `חשבון ${input.invoice.invoiceNumber} ממתין לאישור של ${approver.name}`,
              userId: approver.id,
              metadata: JSON.stringify({
                kind: "invoice_approval_task",
                invoiceId: input.invoice.id,
                approvalId: approval.id,
                approverUserId: approver.id,
                sentByUserId: input.actorUserId,
              }),
            };
          }),
        })
      );
    }

    if (input.notifyInApp) {
      await run("NOTIFICATION_FAILED", () =>
        prisma.notification.createMany({
          data: input.approvers.map((approver) => ({
            userId: approver.id,
            projectId: input.invoice.projectId,
            type: "invoice",
            title: "חשבון ממתין לאישורך",
            message: `חשבון ${input.invoice.invoiceNumber} בפרויקט ${input.invoice.project.name} נשלח לאישורך`,
            link: `/invoices/${input.invoice.id}`,
          })),
        })
      );
    }

    const names = input.approvers.map((approver) => approver.name).join(", ");
    await run("ACTIVITY_FAILED", () =>
      prisma.activity.create({
        data: {
          projectId: input.invoice.projectId,
          type: "status_changed",
          title: "חשבון נשלח לאישור",
          description: `חשבון ${input.invoice.sequenceNumber} נשלח לאישור של: ${names}`,
          userId: input.actorUserId,
          metadata: JSON.stringify({
            invoiceId: input.invoice.id,
            approvalIds: input.approvals.map((approval) => approval.id),
            approverUserIds: input.approvers.map((approver) => approver.id),
            createTask: input.createTask,
            notifyInApp: input.notifyInApp,
            sendWhatsApp: input.sendWhatsApp,
            sendEmail: input.sendEmail,
          }),
        },
      })
    );

    await run("AUDIT_FAILED", () =>
      AuditRepository.log({
        action: "UPDATE",
        entityType: "ProjectInvoiceApproval",
        entityId: input.approvals[0]!.id,
        userId: input.actorUserId,
        metadata: {
          action: "send_for_approval",
          invoiceId: input.invoice.id,
          approverUserIds: input.approvers.map((approver) => approver.id),
        },
      })
    );

    emitDomainEvent("invoice.sent_for_foreman_approval", {
      invoiceId: input.invoice.id,
      projectId: input.invoice.projectId,
      approvalId: input.approvals[0]!.id,
      managerId: input.approvals[0]!.managerId ?? undefined,
      sequenceNumber: input.invoice.sequenceNumber,
      amount: Number(input.invoice.amount),
      actorUserId: input.actorUserId,
    });

    if (failures.length) {
      await AuditRepository.log({
        action: "UPDATE",
        entityType: "ProjectInvoiceApproval",
        entityId: input.approvals[0]!.id,
        userId: input.actorUserId,
        metadata: {
          action: "send_for_approval_side_effect_failure",
          failures,
        },
      }).catch((error) =>
        console.error("[send-for-approval] failure audit failed", error)
      );
    }

    console.info("[send-for-approval] background completed", {
      durationMs: Math.round(performance.now() - startedAt),
      failures,
    });
  }

  static async saveInvoiceDocument(
    invoiceId: string,
    userId: string,
    printBaseUrl?: string
  ) {
    const invoice = await prisma.partialInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        projectId: true,
        invoiceNumber: true,
        sequenceNumber: true,
      },
    });
    if (!invoice) throw new Error("חשבון לא נמצא");

    const printPath = `/print/invoices/${invoiceId}`;
    const url = printBaseUrl
      ? `${printBaseUrl.replace(/\/$/, "")}${printPath}`
      : printPath;
    const folderPath = "חשבונות";
    const docName = `חשבון ${invoice.invoiceNumber || invoice.sequenceNumber}.pdf`;

    const existing = await prisma.document.findFirst({
      where: {
        projectId: invoice.projectId,
        partialInvoiceId: invoiceId,
        folderPath,
        extension: "pdf",
      },
    });
    if (existing) {
      return {
        document: {
          id: existing.id,
          name: existing.name,
          folderPath: existing.folderPath,
          url: existing.url,
        },
        created: false,
      };
    }

    const doc = await DocumentsRepository.create(
      {
        projectId: invoice.projectId,
        name: docName,
        type: "pdf",
        extension: "pdf",
        size: 0,
        bucket: "documents",
        path: `print/invoices/${invoiceId}`,
        url,
        folderPath,
        partialInvoiceId: invoiceId,
      },
      userId
    );

    return {
      document: {
        id: doc.id,
        name: doc.name,
        folderPath: doc.folderPath,
        url: doc.url,
      },
      created: true,
    };
  }

  static async approve(approvalId: string, actorUserId: string, comment?: string) {
    const approval = await prisma.projectInvoiceApproval.findUnique({
      where: { id: approvalId },
      include: { invoice: true },
    });
    if (!approval) throw new Error("בקשת אישור לא נמצאה");
    if (approval.status !== "pending") {
      throw new Error("ניתן לאשר רק בקשה במצב ממתין");
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        name: true,
        role: true,
        employee: { select: { id: true } },
      },
    });
    if (!actor) throw new Error("המשתמש המאשר לא נמצא");
    if (!canApproveDocuments(actor.role)) {
      throw new ApprovalDecisionError("אין הרשאה לאשר חשבונות");
    }
    const isAssigned =
      approval.approverUserId === actorUserId ||
      Boolean(
        approval.managerId && approval.managerId === actor.employee?.id
      );
    const isOverride = isSystemAdminRole(actor.role);
    if (!isAssigned && !isOverride) {
      throw new ApprovalDecisionError(
        "בקשת האישור אינה משויכת למשתמש הנוכחי"
      );
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.projectInvoiceApproval.updateMany({
        where: { id: approvalId, status: "pending" },
        data: {
          status: "approved",
          approvedAt: now,
          comment: comment?.trim() || approval.comment,
        },
      });
      if (claimed.count !== 1) {
        throw new ApprovalDecisionError(
          "בקשת האישור כבר טופלה על ידי משתמש אחר",
          409
        );
      }
      const row = await tx.projectInvoiceApproval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
      });

      await tx.partialInvoice.update({
        where: { id: approval.invoiceId },
        data: {
          status: "approved_by_foreman",
          approverNameSnapshot: actor.name,
          snapshotLockedAt: now,
          updatedById: actorUserId,
        },
      });

      await tx.activity.create({
        data: {
          projectId: approval.projectId,
          type: "status_changed",
          title: "חשבון אושר",
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
      metadata: {
        action: "approve",
        invoiceId: approval.invoiceId,
        assignedApprover: isAssigned,
        systemManagerOverride: !isAssigned && isOverride,
      },
    });

    emitDomainEvent("invoice.approved_by_foreman", {
      invoiceId: approval.invoiceId,
      projectId: approval.projectId,
      approvalId,
      managerId: approval.managerId ?? undefined,
      sequenceNumber: approval.invoice.sequenceNumber,
      amount: Number(approval.invoice.amount),
      comment: comment ?? null,
      actorUserId,
    });

    return mapApproval(updated);
  }

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

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        role: true,
        employee: { select: { id: true } },
      },
    });
    if (!actor || !canApproveDocuments(actor.role)) {
      throw new ApprovalDecisionError("אין הרשאה לדחות חשבונות");
    }
    const isAssigned =
      approval.approverUserId === actorUserId ||
      Boolean(
        approval.managerId && approval.managerId === actor.employee?.id
      );
    const isOverride = isSystemAdminRole(actor.role);
    if (!isAssigned && !isOverride) {
      throw new ApprovalDecisionError(
        "בקשת האישור אינה משויכת למשתמש הנוכחי"
      );
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.projectInvoiceApproval.updateMany({
        where: { id: approvalId, status: "pending" },
        data: {
          status: "rejected",
          rejectedAt: now,
          comment: comment.trim(),
        },
      });
      if (claimed.count !== 1) {
        throw new ApprovalDecisionError(
          "בקשת האישור כבר טופלה על ידי משתמש אחר",
          409
        );
      }
      const row = await tx.projectInvoiceApproval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
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
          title: "חשבון נדחה",
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
        assignedApprover: isAssigned,
        systemManagerOverride: !isAssigned && isOverride,
      },
    });

    emitDomainEvent("invoice.rejected_by_foreman", {
      invoiceId: approval.invoiceId,
      projectId: approval.projectId,
      approvalId,
      managerId: approval.managerId ?? undefined,
      sequenceNumber: approval.invoice.sequenceNumber,
      amount: Number(approval.invoice.amount),
      comment: comment.trim(),
      actorUserId,
    });

    return mapApproval(updated);
  }

  static async markSentToClient(invoiceId: string, userId: string) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!canSendFinancialToClient(actor?.role)) {
      throw new Error(SEND_TO_CLIENT_FORBIDDEN_MESSAGE);
    }

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
