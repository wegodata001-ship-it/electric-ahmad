import { prisma } from "@/lib/prisma";
import type { OpsDeliveryNoteStatus, DocApprovalStatus } from "@prisma/client";
import {
  allocateDocumentNumber,
  isDocEditableStatus,
} from "@/lib/documents/sequences";
import {
  generateSignToken,
  hashSignToken,
  buildSignUrl,
  parseSignQuery,
} from "@/lib/documents/sign-tokens";
import {
  assertCanSoftDelete,
  OPS_DN_EDITABLE_STATUSES,
} from "@/lib/workflow/document-guards";

export type OpsDnItemInput = {
  description: string;
  unit?: string;
  quantity: number;
  notes?: string | null;
};

export type CreateOpsDnInput = {
  projectId?: string | null;
  foremanId: string;
  noteDate: Date;
  clientName: string;
  address?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  notes?: string | null;
  items?: OpsDnItemInput[];
  foremanSignatureUrl?: string | null;
  foremanSignedName?: string | null;
  createdById: string;
};

export type UpdateOpsDnInput = Partial<
  Omit<CreateOpsDnInput, "foremanId" | "createdById">
> & { updatedById: string };

const includeDetail = {
  project: { select: { id: true, name: true, location: true, contractor: true } },
  foreman: { select: { id: true, firstName: true, lastName: true, phone: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  media: { orderBy: { createdAt: "desc" as const } },
  attachments: { orderBy: { createdAt: "desc" as const } },
  approvals: {
    orderBy: { createdAt: "asc" as const },
    include: { approver: { select: { id: true, name: true, role: true } } },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
    include: { actor: { select: { id: true, name: true } } },
  },
};

function mapNote(row: any) {
  return {
    id: row.id,
    documentNumber: row.documentNumber,
    sequenceNumber: row.sequenceNumber,
    status: row.status as OpsDeliveryNoteStatus,
    projectId: row.projectId,
    clientName: row.clientName,
    address: row.address,
    foremanId: row.foremanId,
    noteDate: row.noteDate.toISOString().slice(0, 10),
    vehicleNumber: row.vehicleNumber,
    driverName: row.driverName,
    notes: row.notes,
    foremanSignatureUrl: row.foremanSignatureUrl,
    foremanSignedAt: row.foremanSignedAt?.toISOString() ?? null,
    foremanSignedName: row.foremanSignedName,
    clientSignatureUrl: row.clientSignatureUrl,
    clientSignedName: row.clientSignedName,
    clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
    signedPdfUrl: row.signedPdfUrl ?? null,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    whatsappSentAt: row.whatsappSentAt?.toISOString() ?? null,
    currentVersion: row.currentVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.project,
    foreman: row.foreman
      ? {
          id: row.foreman.id,
          name: `${row.foreman.firstName} ${row.foreman.lastName}`,
          phone: row.foreman.phone,
        }
      : null,
    items: (row.items ?? []).map((i: any) => ({
      id: i.id,
      description: i.description,
      unit: i.unit,
      quantity: Number(i.quantity),
      notes: i.notes,
    })),
    media: row.media ?? [],
    attachments: row.attachments ?? [],
    approvals: (row.approvals ?? []).map((a: any) => ({
      id: a.id,
      status: a.status as DocApprovalStatus,
      comment: a.comment,
      sentAt: a.sentAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      approver: a.approver,
    })),
    rejectionComment:
      (row.approvals ?? [])
        .filter((a: any) => a.status === "rejected" && a.comment)
        .sort(
          (a: any, b: any) =>
            (b.decidedAt?.getTime?.() ?? 0) - (a.decidedAt?.getTime?.() ?? 0)
        )[0]?.comment ?? null,
    events: (row.events ?? []).map((e: any) => ({
      id: e.id,
      action: e.action,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      actor: e.actor,
    })),
  };
}

async function addEvent(
  opsDeliveryNoteId: string,
  action: string,
  message: string,
  actorId?: string | null
) {
  await prisma.opsDeliveryNoteEvent.create({
    data: { opsDeliveryNoteId, action, message, actorId: actorId ?? null },
  });
}

async function notifyUsers(
  userIds: string[],
  title: string,
  message: string,
  link: string,
  projectId?: string | null
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      projectId: projectId ?? null,
      type: "document" as const,
      title,
      message,
      link,
    })),
  });
}

export const OpsDeliveryNotesRepository = {
  async getById(id: string) {
    const row = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      include: includeDetail,
    });
    return row ? mapNote(row) : null;
  },

  async list(filters: {
    foremanId?: string;
    projectId?: string;
    status?: OpsDeliveryNoteStatus;
    take?: number;
    skip?: number;
  }) {
    const where: any = { deletedAt: null };
    if (filters.foremanId) where.foremanId = filters.foremanId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;

    const rows = await prisma.opsDeliveryNote.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        foreman: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });

    return rows.map((row) => ({
      id: row.id,
      documentNumber: row.documentNumber,
      status: row.status,
      noteDate: row.noteDate.toISOString().slice(0, 10),
      clientName: row.clientName,
      project: row.project,
      foreman: row.foreman
        ? { id: row.foreman.id, name: `${row.foreman.firstName} ${row.foreman.lastName}` }
        : null,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async create(input: CreateOpsDnInput) {
    const { documentNumber, sequenceNumber } = await allocateDocumentNumber("delivery_note");

    const row = await prisma.opsDeliveryNote.create({
      data: {
        documentNumber,
        sequenceNumber,
        projectId: input.projectId ?? null,
        foremanId: input.foremanId,
        noteDate: input.noteDate,
        clientName: input.clientName,
        address: input.address ?? null,
        vehicleNumber: input.vehicleNumber ?? null,
        driverName: input.driverName ?? null,
        notes: input.notes ?? null,
        foremanSignatureUrl: input.foremanSignatureUrl ?? null,
        foremanSignedName: input.foremanSignedName ?? null,
        foremanSignedAt: input.foremanSignatureUrl ? new Date() : null,
        createdById: input.createdById,
        updatedById: input.createdById,
        items: {
          create: (input.items ?? []).map((item, i) => ({
            description: item.description,
            unit: item.unit ?? "יח'",
            quantity: item.quantity,
            notes: item.notes ?? null,
            sortOrder: i,
          })),
        },
      },
      include: includeDetail,
    });

    await addEvent(row.id, "created", `נוצרה תעודת משלוח ${documentNumber}`, input.createdById);
    return mapNote(row);
  },

  async update(id: string, input: UpdateOpsDnInput) {
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");
    if (!isDocEditableStatus(existing.status)) {
      throw new Error("לא ניתן לערוך מסמך לאחר שליחה לאישור");
    }

    await prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.opsDeliveryNoteItem.deleteMany({ where: { opsDeliveryNoteId: id } });
        await tx.opsDeliveryNoteItem.createMany({
          data: input.items.map((item, i) => ({
            opsDeliveryNoteId: id,
            description: item.description,
            unit: item.unit ?? "יח'",
            quantity: item.quantity,
            notes: item.notes ?? null,
            sortOrder: i,
          })),
        });
      }
      await tx.opsDeliveryNote.update({
        where: { id },
        data: {
          projectId: input.projectId,
          noteDate: input.noteDate,
          clientName: input.clientName,
          address: input.address,
          vehicleNumber: input.vehicleNumber,
          driverName: input.driverName,
          notes: input.notes,
          foremanSignatureUrl: input.foremanSignatureUrl,
          foremanSignedName: input.foremanSignedName,
          foremanSignedAt: input.foremanSignatureUrl ? new Date() : undefined,
          updatedById: input.updatedById,
          currentVersion: { increment: 1 },
          status: existing.status === "revision" ? "draft" : undefined,
        },
      });
    });

    await addEvent(id, "updated", "המסמך עודכן", input.updatedById);
    return this.getById(id);
  },

  async softDelete(id: string, actorId: string) {
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");

    // Once the DN has been signed/approved/locked it must remain in history:
    // deleting it would break signature verification and audit continuity.
    assertCanSoftDelete(String(existing.status), existing.lockedAt, {
      entityLabel: "תעודת משלוח",
      editableStatuses: OPS_DN_EDITABLE_STATUSES,
    });

    await prisma.opsDeliveryNote.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    await addEvent(
      id,
      "deleted",
      `נמחקה (מספר ${existing.documentNumber} נשמר בהיסטוריה)`,
      actorId
    );
  },

  async submitForApproval(id: string, approverIds: string[], actorId: string) {
    if (!approverIds.length) throw new Error("יש לבחור לפחות מאשר אחד");
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");
    if (!isDocEditableStatus(existing.status)) {
      throw new Error("המסמך אינו ניתן לשליחה לאישור במצב הנוכחי");
    }

    await prisma.$transaction(async (tx) => {
      await tx.opsDeliveryNoteApproval.updateMany({
        where: { opsDeliveryNoteId: id, status: "pending" },
        data: { status: "cancelled" },
      });
      await tx.opsDeliveryNoteApproval.createMany({
        data: approverIds.map((approverId) => ({
          opsDeliveryNoteId: id,
          approverId,
          status: "pending" as DocApprovalStatus,
        })),
      });
      await tx.opsDeliveryNote.update({
        where: { id },
        data: { status: "pending_approval", updatedById: actorId },
      });
    });

    await addEvent(id, "submitted", "נשלחה לאישור", actorId);
    await notifyUsers(
      approverIds,
      "תעודת משלוח ממתינה לאישור",
      `${existing.documentNumber} ממתינה לאישורך`,
      `/approvals`,
      existing.projectId
    );
    return this.getById(id);
  },

  async decideApproval(
    id: string,
    approverId: string,
    decision: "approved" | "rejected",
    comment?: string | null
  ) {
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      include: { approvals: true },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");

    const mine = existing.approvals.find(
      (a) => a.approverId === approverId && a.status === "pending"
    );
    if (!mine) throw new Error("אין בקשת אישור ממתינה עבורך");

    if (decision === "rejected") {
      if (!comment?.trim()) throw new Error("חובה לרשום סיבה להחזרה לתיקון");
      await prisma.$transaction(async (tx) => {
        await tx.opsDeliveryNoteApproval.update({
          where: { id: mine.id },
          data: { status: "rejected", comment, decidedAt: new Date() },
        });
        await tx.opsDeliveryNoteApproval.updateMany({
          where: { opsDeliveryNoteId: id, status: "pending" },
          data: { status: "cancelled" },
        });
        await tx.opsDeliveryNote.update({
          where: { id },
          data: { status: "revision", updatedById: approverId },
        });
      });
      await addEvent(id, "returned", `הוחזרה לתיקון: ${comment}`, approverId);
      await notifyUsers(
        [existing.createdById],
        "תעודת משלוח הוחזרה לתיקון",
        `${existing.documentNumber}: ${comment}`,
        `/field/delivery-notes/${id}`,
        existing.projectId
      );
      return this.getById(id);
    }

    await prisma.opsDeliveryNoteApproval.update({
      where: { id: mine.id },
      data: { status: "approved", comment: comment ?? null, decidedAt: new Date() },
    });

    const pending = await prisma.opsDeliveryNoteApproval.count({
      where: { opsDeliveryNoteId: id, status: "pending" },
    });

    if (pending === 0) {
      await prisma.opsDeliveryNote.update({
        where: { id },
        data: { status: "approved", updatedById: approverId },
      });
      await addEvent(id, "approved", "התעודה אושרה", approverId);
      await notifyUsers(
        [existing.createdById],
        "תעודת משלוח אושרה",
        `${existing.documentNumber} אושרה`,
        `/field/delivery-notes/${id}`,
        existing.projectId
      );
    }

    return this.getById(id);
  },

  async createClientSignLink(id: string, actorId: string, baseUrl: string) {
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");
    if (existing.status !== "approved" && existing.status !== "sent_to_client") {
      throw new Error("ניתן לשלוח ללקוח רק לאחר אישור");
    }

    await prisma.opsDeliveryNoteSignToken.updateMany({
      where: { opsDeliveryNoteId: id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { raw, hash, publicId } = generateSignToken();
    await prisma.opsDeliveryNoteSignToken.create({
      data: {
        opsDeliveryNoteId: id,
        tokenHash: hash,
        publicId,
        createdById: actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.opsDeliveryNote.update({
      where: { id },
      data: { status: "sent_to_client", updatedById: actorId, whatsappSentAt: new Date() },
    });

    const url = buildSignUrl({
      baseUrl,
      kind: "delivery-note",
      documentNumber: existing.documentNumber,
      publicId,
      rawToken: raw,
    });

    await addEvent(id, "sent_to_client", "נשלחה ללקוח לחתימה", actorId);
    return { url, documentNumber: existing.documentNumber };
  },

  async getPublicForSign(documentNumber: string, tokenParam: string) {
    const { buildDeliveryPortal } = await import(
      "@/lib/share/client-portal-payload"
    );
    const parsed = parseSignQuery(tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.opsDeliveryNoteSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        opsDeliveryNote: { documentNumber, deletedAt: null },
      },
      include: { opsDeliveryNote: { include: includeDetail } },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const mapped = mapNote(token.opsDeliveryNote);
    let sentBy: string | null = null;
    if (token.createdById) {
      const u = await prisma.user.findUnique({
        where: { id: token.createdById },
        select: { name: true },
      });
      sentBy = u?.name ?? null;
    }

    const { buildVerificationId } = await import(
      "@/lib/share/archive-signed-document"
    );
    const verificationId = buildVerificationId(
      mapped.documentNumber,
      token.publicId
    );
    const portal = await buildDeliveryPortal(mapped, {
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      sentBy,
      alreadySigned: Boolean(token.usedAt || token.opsDeliveryNote.clientSignedAt),
    });

    return {
      ...mapped,
      portal: {
        ...portal,
        signedPdfUrl: mapped.signedPdfUrl || portal.signedPdfUrl,
      },
      alreadySigned: portal.alreadySigned,
      verificationId,
    };
  },

  async applyClientSignature(opts: {
    documentNumber: string;
    tokenParam: string;
    signatureDataUrl: string;
    signerName: string;
    ip?: string | null;
    device?: string | null;
    saveToDocuments?: boolean;
  }) {
    const { assertValidSignatureDataUrl } = await import(
      "@/lib/share/validate-signature"
    );
    const {
      archiveClientSignedDocument,
      buildVerificationId,
    } = await import("@/lib/share/archive-signed-document");

    const signatureDataUrl = assertValidSignatureDataUrl(opts.signatureDataUrl);
    const parsed = parseSignQuery(opts.tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.opsDeliveryNoteSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        usedAt: null,
        opsDeliveryNote: { documentNumber: opts.documentNumber, deletedAt: null },
      },
      include: { opsDeliveryNote: true },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const note = token.opsDeliveryNote;
    const signedAt = new Date();
    const verificationId = buildVerificationId(
      note.documentNumber,
      token.publicId
    );
    const signedViewPath = `/sign/delivery-note/${encodeURIComponent(note.documentNumber)}/signed?t=${encodeURIComponent(opts.tokenParam)}`;

    await prisma.$transaction(async (tx) => {
      await tx.opsDeliveryNoteSignToken.update({
        where: { id: token.id },
        data: { usedAt: signedAt },
      });
      await tx.opsDeliveryNote.update({
        where: { id: note.id },
        data: {
          clientSignatureUrl: signatureDataUrl,
          clientSignedName: opts.signerName,
          clientSignedAt: signedAt,
          clientSignedIp: opts.ip ?? null,
          clientSignedDevice: opts.device ?? null,
          clientSignedVersion: note.currentVersion,
          status: "signed",
          lockedAt: signedAt,
          signedPdfUrl: signedViewPath,
        },
      });
    });

    await addEvent(note.id, "client_signed", `נחתם ע״י ${opts.signerName}`);

    if (note.projectId && opts.saveToDocuments !== false) {
      await archiveClientSignedDocument({
        kind: "delivery_note",
        projectId: note.projectId,
        entityId: note.id,
        documentNumber: note.documentNumber,
        userId: note.createdById,
        signedViewPath,
        signerName: opts.signerName,
        signedAt,
        ip: opts.ip,
        device: opts.device,
        linkPublicId: token.publicId,
        verificationId,
      });
    }

    await notifyUsers(
      [note.createdById, note.updatedById],
      "הלקוח חתם על תעודת משלוח",
      `${note.documentNumber} נחתמה ע״י ${opts.signerName}`,
      signedViewPath,
      note.projectId
    );

    const mapped = await this.getById(note.id);
    return {
      ...mapped,
      verificationId,
      signedViewUrl: signedViewPath,
      signedPdfUrl: signedViewPath,
      alreadySigned: true,
    };
  },

  async listPendingApprovals(approverId: string) {
    const rows = await prisma.opsDeliveryNoteApproval.findMany({
      where: { approverId, status: "pending" },
      include: {
        opsDeliveryNote: {
          include: {
            project: { select: { id: true, name: true } },
            foreman: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    return rows
      .filter((r) => !r.opsDeliveryNote.deletedAt)
      .map((r) => ({
        approvalId: r.id,
        kind: "delivery_note" as const,
        documentId: r.opsDeliveryNote.id,
        documentNumber: r.opsDeliveryNote.documentNumber,
        project: r.opsDeliveryNote.project,
        foremanName: `${r.opsDeliveryNote.foreman.firstName} ${r.opsDeliveryNote.foreman.lastName}`,
        workDate: r.opsDeliveryNote.noteDate.toISOString().slice(0, 10),
        sentAt: r.sentAt.toISOString(),
        status: r.opsDeliveryNote.status,
      }));
  },

  async addMedia(
    id: string,
    media: {
      name: string;
      url: string;
      path?: string;
      bucket?: string;
      size?: number;
      stage?: string;
    }
  ) {
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");
    if (!isDocEditableStatus(existing.status)) {
      throw new Error("לא ניתן להעלות קבצים במצב הנוכחי");
    }
    return prisma.opsDeliveryNoteMedia.create({
      data: {
        opsDeliveryNoteId: id,
        name: media.name,
        url: media.url,
        path: media.path,
        bucket: media.bucket,
        size: media.size ?? 0,
        stage: media.stage ?? "other",
      },
    });
  },
};
