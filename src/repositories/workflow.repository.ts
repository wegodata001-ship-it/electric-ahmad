import { CONVERSATION_EVENT_TYPE } from "@/lib/engines/conversation";
import type { ConversationMessage } from "@/lib/engines/conversation";
import { prisma } from "@/lib/prisma";
import { getWorkflowDefinition } from "@/lib/workflow/definitions";
import { notifyWorkflowUsers } from "@/lib/workflow/notifications";
import { assertOverrideAllowed } from "@/lib/workflow/override";
import {
  assertTransition,
  isEditableStatus,
  listAllowedActions,
  getNextStepLabel,
  WorkflowTransitionError,
} from "@/lib/workflow/status-engine";
import type {
  ClientSignatureStatus,
  WorkflowAction,
  WorkflowActor,
  WorkflowDocKind,
  WorkflowStatus,
} from "@/lib/workflow/types";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import type {
  WorkflowDocKind as PrismaKind,
  WorkflowStatus as PrismaStatus,
  ClientSignatureStatus as PrismaClientSig,
} from "@prisma/client";

function mapDoc(row: any) {
  const kind = row.kind as WorkflowDocKind;
  return {
    id: row.id,
    kind,
    documentNumber: row.documentNumber,
    projectId: row.projectId,
    projectName: row.project?.name,
    title: row.title,
    status: row.status as WorkflowStatus,
    statusLabel: WORKFLOW_STATUS_LABELS[row.status as WorkflowStatus] ?? row.status,
    version: row.version,
    currentOwnerId: row.currentOwnerId,
    currentOwnerName: row.currentOwner?.name ?? null,
    clientSignatureStatus: row.clientSignatureStatus as ClientSignatureStatus,
    sourceDocumentId: row.sourceDocumentId,
    parentDocumentId: row.parentDocumentId,
    nextDocumentId: row.nextDocumentId,
    legacyEntityType: row.legacyEntityType,
    legacyEntityId: row.legacyEntityId,
    metadataJson: row.metadataJson,
    editable: isEditableStatus(kind, row.status),
    nextStep: getNextStepLabel(kind, row.status),
    allowedActions: listAllowedActions(kind, row.status),
    createdById: row.createdById,
    createdByName: row.createdBy?.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvals: (row.approvals ?? []).map((a: any) => ({
      id: a.id,
      approverId: a.approverId,
      approverName: a.approver?.name,
      status: a.status,
      comment: a.comment,
      sentAt: a.sentAt?.toISOString() ?? null,
      decidedAt: a.decidedAt?.toISOString() ?? null,
    })),
    attachments: (row.attachments ?? []).map((att: any) => ({
      id: att.id,
      name: att.name,
      fileType: att.fileType,
      extension: att.extension,
      size: att.size,
      url: att.url,
      uploadedBy: att.uploadedBy?.name,
      uploadedAt: att.createdAt.toISOString(),
    })),
    events: (row.events ?? []).map((e: any) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorName: e.actor?.name ?? null,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata,
    })),
    versions: (row.versions ?? []).map((v: any) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
    })),
    overrides: (row.overrides ?? []).map((o: any) => ({
      id: o.id,
      reason: o.reason,
      note: o.note,
      fromStatus: o.fromStatus,
      toStatus: o.toStatus,
      actorName: o.actor?.name,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

const fullInclude = {
  project: { select: { name: true } },
  currentOwner: { select: { name: true } },
  createdBy: { select: { name: true } },
  approvals: {
    include: { approver: { select: { name: true } } },
    orderBy: { sentAt: "desc" as const },
  },
  attachments: {
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  events: {
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 100,
  },
  versions: { orderBy: { version: "desc" as const } },
  overrides: {
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

async function nextDocumentNumber(kind: WorkflowDocKind): Promise<string> {
  const def = getWorkflowDefinition(kind);
  const prefix = def.numberPrefix;
  const last = await prisma.workflowDocument.findFirst({
    where: { kind: kind as PrismaKind },
    orderBy: { createdAt: "desc" },
    select: { documentNumber: true },
  });
  let seq = 1;
  if (last?.documentNumber) {
    const m = last.documentNumber.match(/(\d+)$/);
    if (m) seq = Number(m[1]) + 1;
  }
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

export class WorkflowRepository {
  static async getById(id: string) {
    const row = await prisma.workflowDocument.findUnique({
      where: { id },
      include: fullInclude,
    });
    return row ? mapDoc(row) : null;
  }

  static async getByNumber(kind: WorkflowDocKind, documentNumber: string) {
    const row = await prisma.workflowDocument.findUnique({
      where: {
        kind_documentNumber: {
          kind: kind as PrismaKind,
          documentNumber,
        },
      },
      include: fullInclude,
    });
    return row ? mapDoc(row) : null;
  }

  static async listByProject(projectId: string, kind?: WorkflowDocKind) {
    const rows = await prisma.workflowDocument.findMany({
      where: {
        projectId,
        ...(kind ? { kind: kind as PrismaKind } : {}),
      },
      include: fullInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapDoc);
  }

  static async create(input: {
    kind: WorkflowDocKind;
    projectId: string;
    title?: string;
    currentOwnerId?: string | null;
    sourceDocumentId?: string | null;
    parentDocumentId?: string | null;
    nextDocumentId?: string | null;
    legacyEntityType?: string | null;
    legacyEntityId?: string | null;
    documentNumber?: string;
    actor: WorkflowActor;
  }) {
    const def = getWorkflowDefinition(input.kind);
    const documentNumber =
      input.documentNumber?.trim() || (await nextDocumentNumber(input.kind));

    const row = await prisma.workflowDocument.create({
      data: {
        kind: input.kind as PrismaKind,
        documentNumber,
        projectId: input.projectId,
        title: input.title ?? `${def.labelHe} ${documentNumber}`,
        status: def.initialStatus as PrismaStatus,
        version: 1,
        currentOwnerId: input.currentOwnerId ?? input.actor.userId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        parentDocumentId: input.parentDocumentId ?? null,
        nextDocumentId: input.nextDocumentId ?? null,
        legacyEntityType: input.legacyEntityType ?? null,
        legacyEntityId: input.legacyEntityId ?? null,
        createdById: input.actor.userId,
        updatedById: input.actor.userId,
        versions: {
          create: {
            version: 1,
            status: def.initialStatus as PrismaStatus,
            note: "יצירה",
            actorId: input.actor.userId,
            snapshotJson: "{}",
          },
        },
        events: {
          create: {
            type: "created",
            message: `נוצר ${def.labelHe} ${documentNumber}`,
            toStatus: def.initialStatus as PrismaStatus,
            actorId: input.actor.userId,
          },
        },
      },
      include: fullInclude,
    });

    return mapDoc(row);
  }

  private static async addEvent(
    documentId: string,
    data: {
      type: string;
      message: string;
      fromStatus?: WorkflowStatus | null;
      toStatus?: WorkflowStatus | null;
      actorId?: string | null;
      metadata?: unknown;
    }
  ) {
    await prisma.workflowEvent.create({
      data: {
        documentId,
        type: data.type,
        message: data.message,
        fromStatus: (data.fromStatus as PrismaStatus) ?? null,
        toStatus: (data.toStatus as PrismaStatus) ?? null,
        actorId: data.actorId ?? null,
        metadata: data.metadata != null ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  private static async bumpVersion(
    documentId: string,
    status: WorkflowStatus,
    actorId: string,
    note: string
  ) {
    const doc = await prisma.workflowDocument.findUnique({
      where: { id: documentId },
      select: { version: true },
    });
    if (!doc) return;
    const version = doc.version + 1;
    await prisma.workflowDocument.update({
      where: { id: documentId },
      data: { version, updatedById: actorId },
    });
    await prisma.workflowDocVersion.create({
      data: {
        documentId,
        version,
        status: status as PrismaStatus,
        note,
        actorId,
        snapshotJson: "{}",
      },
    });
  }

  /**
   * מעבר סטטוס רגיל לפי הגדרות המנוע.
   */
  static async transition(input: {
    documentId: string;
    action: WorkflowAction;
    actor: WorkflowActor;
    comment?: string | null;
    approverIds?: string[];
  }) {
    const existing = await prisma.workflowDocument.findUnique({
      where: { id: input.documentId },
      include: { approvals: true },
    });
    if (!existing) throw new WorkflowTransitionError("מסמך לא נמצא");

    const kind = existing.kind as WorkflowDocKind;
    const from = existing.status as WorkflowStatus;
    const definition = getWorkflowDefinition(kind);
    const transition = assertTransition({
      kind,
      from,
      action: input.action,
      actor: input.actor,
      comment: input.comment,
      approverIds: input.approverIds,
    });

    // אישור — any_one (ברירת מחדל) או all_must לפי הגדרת המסמך
    if (input.action === "approve") {
      const mine = existing.approvals.find(
        (a) => a.approverId === input.actor.userId && a.status === "pending"
      );
      if (!mine) {
        throw new WorkflowTransitionError("אין בקשת אישור ממתינה עבורך");
      }
      await prisma.workflowApproval.update({
        where: { id: mine.id },
        data: {
          status: "approved",
          comment: input.comment ?? null,
          decidedAt: new Date(),
        },
      });

      if (definition.approvalMode === "any_one") {
        await prisma.workflowApproval.updateMany({
          where: { documentId: input.documentId, status: "pending" },
          data: { status: "cancelled" },
        });
      } else {
        const pending = await prisma.workflowApproval.count({
          where: { documentId: input.documentId, status: "pending" },
        });
        if (pending > 0) {
          await this.addEvent(input.documentId, {
            type: "partial_approved",
            message: "אישור חלקי התקבל",
            fromStatus: from,
            actorId: input.actor.userId,
          });
          return this.getById(input.documentId);
        }
      }
    }

    if (input.action === "reject") {
      const mine = existing.approvals.find(
        (a) => a.approverId === input.actor.userId && a.status === "pending"
      );
      if (!mine) {
        throw new WorkflowTransitionError("אין בקשת אישור ממתינה עבורך");
      }
      await prisma.workflowApproval.update({
        where: { id: mine.id },
        data: {
          status: "rejected",
          comment: input.comment?.trim() || null,
          decidedAt: new Date(),
        },
      });
      await prisma.workflowApproval.updateMany({
        where: { documentId: input.documentId, status: "pending" },
        data: { status: "cancelled" },
      });
    }

    if (input.action === "submit" || input.action === "resubmit") {
      await prisma.workflowApproval.updateMany({
        where: { documentId: input.documentId, status: "pending" },
        data: { status: "cancelled" },
      });
      const ids = [...new Set((input.approverIds ?? []).filter(Boolean))];
      if (ids.length) {
        await prisma.workflowApproval.createMany({
          data: ids.map((approverId) => ({
            documentId: input.documentId,
            approverId,
            status: "pending" as const,
          })),
        });
        await notifyWorkflowUsers({
          userIds: ids,
          projectId: existing.projectId,
          title: "מסמך ממתין לאישור",
          message: `${existing.documentNumber} ממתין לאישורך`,
          link: `/approvals`,
        });
      }
    }

    const clientSigUpdate: Partial<{
      clientSignatureStatus: PrismaClientSig;
    }> = {};
    if (input.action === "send_to_client") {
      clientSigUpdate.clientSignatureStatus = "pending";
    }
    if (input.action === "client_signed") {
      clientSigUpdate.clientSignatureStatus = "signed";
    }

    await prisma.workflowDocument.update({
      where: { id: input.documentId },
      data: {
        status: transition.to as PrismaStatus,
        updatedById: input.actor.userId,
        ...clientSigUpdate,
      },
    });

    await this.bumpVersion(
      input.documentId,
      transition.to,
      input.actor.userId,
      `${input.action}: ${WORKFLOW_STATUS_LABELS[transition.to]}`
    );

    await this.addEvent(input.documentId, {
      type: input.action,
      message: `${WORKFLOW_STATUS_LABELS[from]} → ${WORKFLOW_STATUS_LABELS[transition.to]}`,
      fromStatus: from,
      toStatus: transition.to,
      actorId: input.actor.userId,
      metadata: { comment: input.comment, approverIds: input.approverIds },
    });

    if (input.action === "reject" && existing.createdById) {
      await notifyWorkflowUsers({
        userIds: [existing.createdById],
        projectId: existing.projectId,
        title: "מסמך דורש תיקון",
        message: `${existing.documentNumber}: ${input.comment?.trim() || "הוחזר לתיקון"}`,
      });
    }

    return this.getById(input.documentId);
  }

  /**
   * עקיפת Workflow — System Manager + Reason + Note + Audit.
   */
  static async override(input: {
    documentId: string;
    toStatus: WorkflowStatus;
    reason: string;
    note: string;
    actor: WorkflowActor;
  }) {
    const existing = await prisma.workflowDocument.findUnique({
      where: { id: input.documentId },
    });
    if (!existing) throw new WorkflowTransitionError("מסמך לא נמצא");

    const from = existing.status as WorkflowStatus;
    assertOverrideAllowed({
      actor: input.actor,
      fromStatus: from,
      toStatus: input.toStatus,
      reason: input.reason,
      note: input.note,
    });

    await prisma.$transaction(async (tx) => {
      await tx.workflowOverride.create({
        data: {
          documentId: input.documentId,
          reason: input.reason.trim(),
          note: input.note.trim(),
          fromStatus: from as PrismaStatus,
          toStatus: input.toStatus as PrismaStatus,
          actorId: input.actor.userId,
        },
      });
      await tx.workflowDocument.update({
        where: { id: input.documentId },
        data: {
          status: input.toStatus as PrismaStatus,
          updatedById: input.actor.userId,
          ...(input.toStatus === "client_signed"
            ? { clientSignatureStatus: "signed" as PrismaClientSig }
            : {}),
        },
      });
    });

    await this.bumpVersion(
      input.documentId,
      input.toStatus,
      input.actor.userId,
      `OVERRIDE: ${input.reason}`
    );

    await this.addEvent(input.documentId, {
      type: "override",
      message: `עקיפה: ${WORKFLOW_STATUS_LABELS[from]} → ${WORKFLOW_STATUS_LABELS[input.toStatus]}`,
      fromStatus: from,
      toStatus: input.toStatus,
      actorId: input.actor.userId,
      metadata: { reason: input.reason, note: input.note },
    });

    return this.getById(input.documentId);
  }

  static async markClientOpened(documentId: string) {
    const doc = await prisma.workflowDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new WorkflowTransitionError("מסמך לא נמצא");
    if (doc.clientSignatureStatus === "signed") return this.getById(documentId);

    await prisma.workflowDocument.update({
      where: { id: documentId },
      data: { clientSignatureStatus: "opened" },
    });
    await this.addEvent(documentId, {
      type: "client_opened",
      message: "הלקוח פתח את קישור החתימה",
      actorId: null,
    });
    return this.getById(documentId);
  }

  static async addAttachment(
    documentId: string,
    data: {
      name: string;
      fileType: string;
      extension: string;
      size: number;
      bucket: string;
      path: string;
      url: string;
    },
    actor: WorkflowActor
  ) {
    const doc = await prisma.workflowDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new WorkflowTransitionError("מסמך לא נמצא");
    if (!isEditableStatus(doc.kind as WorkflowDocKind, doc.status as WorkflowStatus)) {
      throw new WorkflowTransitionError("לא ניתן להוסיף קבצים במצב הנוכחי");
    }

    await prisma.workflowAttachment.create({
      data: {
        documentId,
        ...data,
        uploadedById: actor.userId,
      },
    });
    await this.addEvent(documentId, {
      type: "attachment_added",
      message: `צורף קובץ: ${data.name}`,
      actorId: actor.userId,
    });
    return this.getById(documentId);
  }

  static async timeline(documentId: string) {
    const events = await prisma.workflowEvent.findMany({
      where: { documentId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorName: e.actor?.name ?? null,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata,
    }));
  }

  static async addConversationMessage(
    documentId: string,
    actor: WorkflowActor,
    body: string
  ): Promise<ConversationMessage> {
    const trimmed = body.trim();
    if (!trimmed) throw new WorkflowTransitionError("הודעה ריקה");

    const doc = await prisma.workflowDocument.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    if (!doc) throw new WorkflowTransitionError("מסמך לא נמצא");

    const preview =
      trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;

    await this.addEvent(documentId, {
      type: CONVERSATION_EVENT_TYPE,
      message: preview,
      actorId: actor.userId,
      metadata: { body: trimmed },
    });

    const messages = await this.listConversation(documentId);
    const last = messages[messages.length - 1];
    if (!last) throw new WorkflowTransitionError("שגיאה בשמירת הודעה");
    return last;
  }

  static async listConversation(documentId: string): Promise<ConversationMessage[]> {
    const events = await prisma.workflowEvent.findMany({
      where: { documentId, type: CONVERSATION_EVENT_TYPE },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return events.map((e) => {
      let body = e.message;
      if (e.metadata) {
        try {
          const meta = JSON.parse(e.metadata) as { body?: string };
          if (meta.body) body = meta.body;
        } catch {
          /* keep preview message */
        }
      }
      return {
        id: e.id,
        documentId,
        body,
        actorName: e.actor?.name ?? null,
        createdAt: e.createdAt.toISOString(),
      };
    });
  }

  static async listPendingForApprover(approverId: string) {
    const rows = await prisma.workflowApproval.findMany({
      where: { approverId, status: "pending" },
      include: {
        document: {
          include: {
            project: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });
    return rows.map((r) => ({
      approvalId: r.id,
      documentId: r.documentId,
      kind: r.document.kind,
      documentNumber: r.document.documentNumber,
      title: r.document.title,
      status: r.document.status,
      projectId: r.document.projectId,
      projectName: r.document.project.name,
      createdByName: r.document.createdBy.name,
      sentAt: r.sentAt.toISOString(),
    }));
  }
}
