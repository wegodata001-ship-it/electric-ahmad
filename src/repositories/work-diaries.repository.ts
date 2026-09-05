import { prisma } from "@/lib/prisma";
import type { WorkDiaryStatus, DocApprovalStatus } from "@prisma/client";
import {
  allocateDocumentNumber,
} from "@/lib/documents/sequences";
import {
  assertCanSoftDelete,
  DIARY_EDITABLE_STATUSES,
} from "@/lib/workflow/document-guards";
import {
  generateSignToken,
  hashSignToken,
  buildSignUrl,
} from "@/lib/documents/sign-tokens";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { isEditableStatus } from "@/lib/workflow/status-engine";
import {
  syncWorkDiaryArchiveDocument,
  mapLegacyDiaryStatusToWorkflow,
} from "@/lib/workflow/work-diary-documents";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { ensureMiscSitesProject } from "@/lib/field/misc-sites-project";

export type WorkItemInput = {
  description: string;
  unit?: string;
  quantity?: number;
  notes?: string | null;
};

export type DiaryWorkerInput = {
  crewMemberId?: string | null;
  name: string;
  role?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  notes?: string | null;
};

export type NamedQtyInput = {
  name: string;
  quantity?: number | null;
  unit?: string;
  notes?: string | null;
};

export type CreateWorkDiaryInput = {
  projectId?: string | null;
  /** When set, diary is for an unlisted/"אחר" site */
  customSiteName?: string | null;
  foremanId: string;
  workDate: Date;
  workTime?: string | null;
  weather?: string | null;
  workType?: string | null;
  workSummary?: string | null;
  clientName?: string | null;
  address?: string | null;
  notes?: string | null;
  workItems?: WorkItemInput[];
  workers?: DiaryWorkerInput[];
  equipment?: NamedQtyInput[];
  materials?: NamedQtyInput[];
  foremanSignatureUrl?: string | null;
  foremanSignedName?: string | null;
  createdById: string;
};

export type UpdateWorkDiaryInput = Partial<
  Omit<CreateWorkDiaryInput, "foremanId" | "createdById">
> & { updatedById: string };

function hoursBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

const includeDetail = {
  project: {
    select: {
      id: true,
      name: true,
      location: true,
      contractor: true,
      contractNumber: true,
    },
  },
  foreman: { select: { id: true, firstName: true, lastName: true, phone: true } },
  workItems: { orderBy: { sortOrder: "asc" as const } },
  workers: { orderBy: { sortOrder: "asc" as const } },
  equipment: { orderBy: { sortOrder: "asc" as const } },
  materials: { orderBy: { sortOrder: "asc" as const } },
  workflowDocument: {
    include: {
      approvals: {
        orderBy: { createdAt: "asc" as const },
        include: { approver: { select: { id: true, name: true, role: true } } },
      },
      events: {
        orderBy: { createdAt: "desc" as const },
        take: 50,
        include: { actor: { select: { id: true, name: true } } },
      },
      /** מקור אמת יחיד לקבצים — WorkflowAttachment */
      attachments: { orderBy: { createdAt: "desc" as const } },
    },
  },
};

async function actorFromUserId(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });
  if (!u) throw new Error("משתמש לא נמצא");
  return { userId: u.id, role: u.role, name: u.name };
}

function resolveWorkflowStatus(row: any): WorkflowStatus {
  if (row.workflowDocument?.status) {
    return row.workflowDocument.status as WorkflowStatus;
  }
  // תאימות ליומנים שטרם מוגרו בלבד
  return mapLegacyDiaryStatusToWorkflow(String(row.status ?? "draft"));
}

const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "bmp",
]);

function isImageWorkflowAttachment(a: {
  fileType?: string | null;
  extension?: string | null;
  name?: string | null;
}) {
  const ft = String(a.fileType ?? "").toLowerCase();
  if (ft === "image" || ft.startsWith("image/")) return true;
  const ext = String(
    a.extension || a.name?.split(".").pop() || ""
  ).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

/** ממפה WorkflowAttachment לצורת media/attachments שה־UI מצפה לה */
function mapAttachmentsFromWorkflow(wfAttachments: any[] | undefined) {
  const list = wfAttachments ?? [];
  const media = list.filter(isImageWorkflowAttachment).map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    path: a.path,
    bucket: a.bucket,
    size: a.size,
    stage: "other",
    createdAt: a.createdAt,
  }));
  const attachments = list.filter((a) => !isImageWorkflowAttachment(a)).map((a) => ({
    id: a.id,
    name: a.name,
    mimeType: a.fileType,
    size: a.size,
    kind: a.fileType || "document",
    bucket: a.bucket,
    path: a.path,
    url: a.url,
    createdAt: a.createdAt,
  }));
  return { media, attachments };
}

function mapDiary(row: any) {
  const wfStatus = resolveWorkflowStatus(row);
  const wfApprovals = row.workflowDocument?.approvals;
  const wfEvents = row.workflowDocument?.events;
  const { media, attachments } = mapAttachmentsFromWorkflow(
    row.workflowDocument?.attachments
  );

  return {
    id: row.id,
    documentNumber: row.documentNumber,
    sequenceNumber: row.sequenceNumber,
    /** מקור אמת — סטטוס מנוע Workflow */
    status: wfStatus as WorkDiaryStatus,
    statusLabel: WORKFLOW_STATUS_LABELS[wfStatus] ?? wfStatus,
    workflowDocumentId: row.workflowDocumentId ?? row.workflowDocument?.id ?? null,
    projectId: row.projectId,
    customSiteName: row.customSiteName ?? null,
    siteLabel: row.customSiteName || row.project?.name || "—",
    clientName: row.clientName,
    address: row.address,
    foremanId: row.foremanId,
    workDate: row.workDate.toISOString().slice(0, 10),
    workTime: row.workTime,
    weather: row.weather,
    workType: row.workType,
    workSummary: row.workSummary,
    notes: row.notes,
    foremanSignatureUrl: row.foremanSignatureUrl,
    foremanSignedAt: row.foremanSignedAt?.toISOString() ?? null,
    foremanSignedName: row.foremanSignedName,
    clientSignatureUrl: row.clientSignatureUrl,
    clientSignedName: row.clientSignedName,
    clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
    clientSignedIp: row.clientSignedIp,
    clientSignedDevice: row.clientSignedDevice,
    signedPdfUrl: row.signedPdfUrl ?? null,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    currentVersion: row.workflowDocument?.version ?? row.currentVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          location: row.project.location,
          contractor: row.project.contractor,
          contractNumber: row.project.contractNumber,
        }
      : null,
    foreman: row.foreman
      ? {
          id: row.foreman.id,
          name: `${row.foreman.firstName} ${row.foreman.lastName}`,
          phone: row.foreman.phone,
        }
      : null,
    workItems: (row.workItems ?? []).map((i: any) => ({
      id: i.id,
      lineNumber: i.lineNumber,
      description: i.description,
      unit: i.unit,
      quantity: Number(i.quantity),
      notes: i.notes,
    })),
    workers: (row.workers ?? []).map((w: any) => ({
      id: w.id,
      crewMemberId: w.crewMemberId,
      name: w.name,
      role: w.role,
      startTime: w.startTime,
      endTime: w.endTime,
      hours: w.hours,
      notes: w.notes ?? null,
    })),
    equipment: (row.equipment ?? []).map((e: any) => ({
      id: e.id,
      name: e.name,
      quantity: e.quantity != null ? Number(e.quantity) : null,
      notes: e.notes,
    })),
    materials: (row.materials ?? []).map((m: any) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      quantity: Number(m.quantity),
      notes: m.notes,
    })),
    media,
    attachments,
    approvals: (wfApprovals ?? []).map((a: any) => ({
      id: a.id,
      status: a.status as DocApprovalStatus,
      comment: a.comment,
      sentAt: a.sentAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      approver: a.approver,
    })),
    rejectionComment:
      (wfApprovals ?? [])
        .filter((a: any) => a.status === "rejected" && a.comment)
        .sort(
          (a: any, b: any) =>
            (b.decidedAt?.getTime?.() ?? 0) - (a.decidedAt?.getTime?.() ?? 0)
        )[0]?.comment ?? null,
    events: (wfEvents ?? []).map((e: any) => ({
      id: e.id,
      action: e.type,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      actor: e.actor,
    })),
  };
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

export const WorkDiariesRepository = {
  async getById(id: string) {
    const row = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: includeDetail,
    });
    return row ? mapDiary(row) : null;
  },

  async getByDocumentNumber(documentNumber: string) {
    const row = await prisma.workDiary.findFirst({
      where: { documentNumber, deletedAt: null },
      include: includeDetail,
    });
    return row ? mapDiary(row) : null;
  },

  async list(filters: {
    foremanId?: string;
    projectId?: string;
    status?: WorkDiaryStatus;
    take?: number;
    skip?: number;
  }) {
    const where: any = { deletedAt: null };
    if (filters.foremanId) where.foremanId = filters.foremanId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) {
      where.workflowDocument = { status: filters.status };
    }

    const rows = await prisma.workDiary.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        foreman: { select: { id: true, firstName: true, lastName: true } },
        workflowDocument: { select: { id: true, status: true, version: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });

    return rows.map((row) => {
      const status = (row.workflowDocument?.status ??
        mapLegacyDiaryStatusToWorkflow(row.status)) as string;
      return {
        id: row.id,
        documentNumber: row.documentNumber,
        status,
        statusLabel: WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status,
        workflowDocumentId: row.workflowDocumentId,
        workDate: row.workDate.toISOString().slice(0, 10),
        workType: row.workType,
        clientName: row.clientName,
        customSiteName: row.customSiteName ?? null,
        siteLabel: row.customSiteName || row.project?.name || "—",
        project: row.project,
        foreman: row.foreman
          ? {
              id: row.foreman.id,
              name: `${row.foreman.firstName} ${row.foreman.lastName}`,
            }
          : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },

  async archive(filters: {
    documentNumber?: string;
    projectId?: string;
    clientName?: string;
    foremanId?: string;
    status?: WorkDiaryStatus;
    fromDate?: Date;
    toDate?: Date;
    take?: number;
  }) {
    const where: any = { deletedAt: null };
    if (filters.documentNumber) {
      where.documentNumber = { contains: filters.documentNumber, mode: "insensitive" };
    }
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.clientName) {
      where.clientName = { contains: filters.clientName, mode: "insensitive" };
    }
    if (filters.foremanId) where.foremanId = filters.foremanId;
    if (filters.status) {
      where.workflowDocument = { status: filters.status };
    }
    if (filters.fromDate || filters.toDate) {
      where.workDate = {};
      if (filters.fromDate) where.workDate.gte = filters.fromDate;
      if (filters.toDate) where.workDate.lte = filters.toDate;
    }

    const rows = await prisma.workDiary.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        foreman: { select: { id: true, firstName: true, lastName: true } },
        workflowDocument: {
          include: {
            approvals: {
              where: { status: "approved" },
              orderBy: { decidedAt: "desc" },
              take: 1,
              include: { approver: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 100,
    });

    return rows.map((row) => {
      const status = resolveWorkflowStatus(row);
      return {
        id: row.id,
        kind: "work_diary" as const,
        documentNumber: row.documentNumber,
        status,
        statusLabel: WORKFLOW_STATUS_LABELS[status] ?? status,
        workflowDocumentId: row.workflowDocumentId,
        workDate: row.workDate.toISOString().slice(0, 10),
        clientName: row.clientName,
        project: row.project,
        foreman: row.foreman
          ? { id: row.foreman.id, name: `${row.foreman.firstName} ${row.foreman.lastName}` }
          : null,
        approverName:
          row.workflowDocument?.approvals[0]?.approver?.name ?? null,
        clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  },

  async create(input: CreateWorkDiaryInput) {
    const customSite = input.customSiteName?.trim() || null;
    let projectId = input.projectId?.trim() || null;

    if (customSite) {
      projectId = await ensureMiscSitesProject(input.createdById);
    } else if (!projectId) {
      throw new Error("יש לבחור פרויקט או להזין אתר תחת ״אחר״");
    }

    const project = await prisma.project.findUnique({ where: { id: projectId! } });
    if (!project) throw new Error("פרויקט לא נמצא");

    const { documentNumber, sequenceNumber } = await allocateDocumentNumber("work_diary");

    const row = await prisma.workDiary.create({
      data: {
        documentNumber,
        sequenceNumber,
        projectId: projectId!,
        customSiteName: customSite,
        foremanId: input.foremanId,
        workDate: input.workDate,
        workTime: input.workTime ?? null,
        weather: input.weather ?? null,
        workType: input.workType ?? null,
        workSummary: input.workSummary ?? null,
        clientName: input.clientName ?? (customSite || project.contractor),
        address: input.address ?? customSite ?? project.location,
        notes: input.notes ?? null,
        foremanSignatureUrl: input.foremanSignatureUrl ?? null,
        foremanSignedName: input.foremanSignedName ?? null,
        foremanSignedAt: input.foremanSignatureUrl ? new Date() : null,
        createdById: input.createdById,
        updatedById: input.createdById,
        workItems: {
          create: (input.workItems ?? []).map((item, i) => ({
            lineNumber: i + 1,
            description: item.description,
            unit: item.unit ?? "יח'",
            quantity: item.quantity ?? 0,
            notes: item.notes ?? null,
            sortOrder: i,
          })),
        },
        workers: {
          create: (input.workers ?? []).map((w, i) => ({
            crewMemberId: w.crewMemberId ?? null,
            name: w.name,
            role: w.role ?? null,
            startTime: w.startTime ?? null,
            endTime: w.endTime ?? null,
            hours: w.hours ?? hoursBetween(w.startTime, w.endTime),
            notes: w.notes ?? null,
            sortOrder: i,
          })),
        },
        equipment: {
          create: (input.equipment ?? []).map((e, i) => ({
            name: e.name,
            quantity: e.quantity ?? null,
            notes: e.notes ?? null,
            sortOrder: i,
          })),
        },
        materials: {
          create: (input.materials ?? []).map((m, i) => ({
            name: m.name,
            unit: m.unit ?? "יח'",
            quantity: m.quantity ?? 0,
            notes: m.notes ?? null,
            sortOrder: i,
          })),
        },
      },
      include: includeDetail,
    });

    const actor = await actorFromUserId(input.createdById);
    const wf = await WorkflowRepository.create({
      kind: "WORK_DIARY",
      projectId: projectId!,
      title: customSite
        ? `יומן עבודה ${documentNumber} · ${customSite}`
        : `יומן עבודה ${documentNumber}`,
      documentNumber,
      legacyEntityType: "WorkDiary",
      legacyEntityId: row.id,
      currentOwnerId: input.createdById,
      actor,
    });

    await prisma.workDiary.update({
      where: { id: row.id },
      data: { workflowDocumentId: wf.id },
    });

    await prisma.workflowDocument.update({
      where: { id: wf.id },
      data: { legacyEntityId: row.id, legacyEntityType: "WorkDiary" },
    });

    await syncWorkDiaryArchiveDocument({
      workflowDocumentId: wf.id,
      workDiaryId: row.id,
      projectId: projectId!,
      documentNumber,
      title: wf.title,
      status: "draft",
      userId: input.createdById,
    });

    await notifyUsers(
      [input.createdById],
      "יומן עבודה חדש",
      `נוצר יומן ${documentNumber}`,
      `/field/work-diaries/${row.id}`,
      projectId!
    );

    return this.getById(row.id);
  },

  async update(id: string, input: UpdateWorkDiaryInput) {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");

    const wfStatus = existing.workflowDocument
      ? (existing.workflowDocument.status as WorkflowStatus)
      : mapLegacyDiaryStatusToWorkflow(existing.status);

    if (!isEditableStatus("WORK_DIARY", wfStatus)) {
      throw new Error("לא ניתן לערוך מסמך לאחר שליחה לאישור — יש להחזיר לתיקון");
    }
    if (existing.lockedAt) throw new Error("המסמך נעול");

    let nextProjectId = input.projectId;
    let nextCustomSite =
      input.customSiteName !== undefined
        ? input.customSiteName?.trim() || null
        : undefined;

    if (nextCustomSite) {
      nextProjectId = await ensureMiscSitesProject(input.updatedById);
    }

    await prisma.$transaction(async (tx) => {
      if (input.workItems) {
        await tx.workDiaryWorkItem.deleteMany({ where: { workDiaryId: id } });
        await tx.workDiaryWorkItem.createMany({
          data: input.workItems.map((item, i) => ({
            workDiaryId: id,
            lineNumber: i + 1,
            description: item.description,
            unit: item.unit ?? "יח'",
            quantity: item.quantity ?? 0,
            notes: item.notes ?? null,
            sortOrder: i,
          })),
        });
      }
      if (input.workers) {
        await tx.workDiaryWorker.deleteMany({ where: { workDiaryId: id } });
        await tx.workDiaryWorker.createMany({
          data: input.workers.map((w, i) => ({
            workDiaryId: id,
            crewMemberId: w.crewMemberId ?? null,
            name: w.name,
            role: w.role ?? null,
            startTime: w.startTime ?? null,
            endTime: w.endTime ?? null,
            hours: w.hours ?? hoursBetween(w.startTime, w.endTime),
            notes: w.notes ?? null,
            sortOrder: i,
          })),
        });
      }
      if (input.equipment) {
        await tx.workDiaryEquipment.deleteMany({ where: { workDiaryId: id } });
        await tx.workDiaryEquipment.createMany({
          data: input.equipment.map((e, i) => ({
            workDiaryId: id,
            name: e.name,
            quantity: e.quantity ?? null,
            notes: e.notes ?? null,
            sortOrder: i,
          })),
        });
      }
      if (input.materials) {
        await tx.workDiaryMaterial.deleteMany({ where: { workDiaryId: id } });
        await tx.workDiaryMaterial.createMany({
          data: input.materials.map((m, i) => ({
            workDiaryId: id,
            name: m.name,
            unit: m.unit ?? "יח'",
            quantity: m.quantity ?? 0,
            notes: m.notes ?? null,
            sortOrder: i,
          })),
        });
      }

      await tx.workDiary.update({
        where: { id },
        data: {
          ...(nextProjectId ? { projectId: nextProjectId } : {}),
          ...(nextCustomSite !== undefined
            ? { customSiteName: nextCustomSite }
            : {}),
          workDate: input.workDate,
          workTime: input.workTime,
          weather: input.weather,
          workType: input.workType,
          workSummary: input.workSummary,
          clientName: input.clientName,
          address: input.address,
          notes: input.notes,
          foremanSignatureUrl: input.foremanSignatureUrl,
          foremanSignedName: input.foremanSignedName,
          foremanSignedAt: input.foremanSignatureUrl ? new Date() : undefined,
          updatedById: input.updatedById,
          currentVersion: { increment: 1 },
        },
      });
    });

    return this.getById(id);
  },

  async softDelete(id: string, actorId: string) {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");

    // Deleting a diary that was already approved/signed/locked would erase an
    // artefact the workflow (and possibly the client) already relies on. Only
    // draft / in-revision diaries may be deleted.
    const effectiveStatus = existing.workflowDocument
      ? String(existing.workflowDocument.status)
      : mapLegacyDiaryStatusToWorkflow(existing.status);
    assertCanSoftDelete(effectiveStatus, existing.lockedAt, {
      entityLabel: "יומן עבודה",
      editableStatuses: DIARY_EDITABLE_STATUSES,
    });

    await prisma.workDiary.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    if (existing.workflowDocumentId) {
      const actor = await actorFromUserId(actorId);
      await WorkflowRepository.transition({
        documentId: existing.workflowDocumentId,
        action: "cancel",
        actor,
      }).catch(() => undefined);
    }
  },

  async submitForApproval(id: string, approverIds: string[], actorId: string) {
    if (!approverIds.length) throw new Error("יש לבחור לפחות מאשר אחד");
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");

    let workflowDocumentId = existing.workflowDocumentId;
    const actor = await actorFromUserId(actorId);

    if (!workflowDocumentId) {
      const wfDoc = await WorkflowRepository.create({
        kind: "WORK_DIARY",
        projectId: existing.projectId,
        title: `יומן עבודה ${existing.documentNumber}`,
        documentNumber: existing.documentNumber,
        legacyEntityType: "WorkDiary",
        legacyEntityId: existing.id,
        currentOwnerId: actorId,
        actor,
      });
      await prisma.workDiary.update({
        where: { id },
        data: { workflowDocumentId: wfDoc.id },
      });
      workflowDocumentId = wfDoc.id;
    }

    const wfId = workflowDocumentId as string;

    const wfStatus = existing.workflowDocument
      ? (existing.workflowDocument.status as WorkflowStatus)
      : mapLegacyDiaryStatusToWorkflow(existing.status);

    const action =
      wfStatus === "revision" ? ("resubmit" as const) : ("submit" as const);

    const wf = await WorkflowRepository.transition({
      documentId: wfId,
      action,
      approverIds,
      actor,
    });

    await syncWorkDiaryArchiveDocument({
      workflowDocumentId: wfId,
      workDiaryId: id,
      projectId: existing.projectId,
      documentNumber: existing.documentNumber,
      title: wf?.title,
      status: (wf?.status as WorkflowStatus) ?? "pending_approval",
      userId: actorId,
    });

    return this.getById(id);
  },

  async decideApproval(
    id: string,
    approverId: string,
    decision: "approved" | "rejected",
    comment?: string | null
  ) {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");
    if (!existing.workflowDocumentId) {
      throw new Error("יומן זה עדיין לא מחובר למנוע Workflow — יש להריץ מיגרציה");
    }

    const actor = await actorFromUserId(approverId);
    const wf = await WorkflowRepository.transition({
      documentId: existing.workflowDocumentId,
      action: decision === "approved" ? "approve" : "reject",
      comment,
      actor,
    });

    const wfStatus = (wf?.status as WorkflowStatus) ?? "approved";
    const diaryStatus: WorkDiaryStatus =
      decision === "rejected" || wfStatus === "revision"
        ? "revision"
        : wfStatus === "approved"
          ? "approved"
          : "pending_approval";

    await prisma.workDiary.update({
      where: { id },
      data: { status: diaryStatus, updatedById: approverId },
    });

    // Sync legacy WorkDiaryApproval rows (inbox uses Workflow; keep legacy aligned)
    await prisma.workDiaryApproval.updateMany({
      where: { workDiaryId: id, approverId, status: "pending" },
      data: {
        status: decision === "approved" ? "approved" : "rejected",
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    });
    // Any-one / reject: close remaining pending requests
    await prisma.workDiaryApproval.updateMany({
      where: { workDiaryId: id, status: "pending" },
      data: { status: "cancelled" },
    });

    await syncWorkDiaryArchiveDocument({
      workflowDocumentId: existing.workflowDocumentId,
      workDiaryId: id,
      projectId: existing.projectId,
      documentNumber: existing.documentNumber,
      title: wf?.title,
      status: wfStatus,
      userId: approverId,
    });

    if (decision === "rejected") {
      await notifyUsers(
        [existing.createdById],
        "יומן עבודה הוחזר לתיקון",
        `${existing.documentNumber}: ${comment}`,
        `/field/work-diaries/${id}`,
        existing.projectId
      );
    } else if (wfStatus === "approved") {
      await notifyUsers(
        [existing.createdById],
        "יומן עבודה אושר",
        `${existing.documentNumber} אושר`,
        `/field/work-diaries/${id}`,
        existing.projectId
      );
    }

    const diary = await this.getById(id);
    return {
      ...diary,
      approvalComplete: decision === "approved" && wfStatus === "approved",
      awaitingOtherApprovers: false,
    };
  },

  async createClientSignLink(
    id: string,
    actorId: string,
    baseUrl: string
  ): Promise<{ url: string; documentNumber: string }> {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");

    const wfStatus = existing.workflowDocument
      ? (existing.workflowDocument.status as WorkflowStatus)
      : mapLegacyDiaryStatusToWorkflow(existing.status);

    if (wfStatus !== "approved" && wfStatus !== "sent_to_client") {
      throw new Error("ניתן לשלוח ללקוח רק לאחר אישור");
    }

    if (existing.workflowDocumentId && wfStatus === "approved") {
      const actor = await actorFromUserId(actorId);
      await WorkflowRepository.transition({
        documentId: existing.workflowDocumentId,
        action: "send_to_client",
        actor,
      });
      await syncWorkDiaryArchiveDocument({
        workflowDocumentId: existing.workflowDocumentId,
        workDiaryId: id,
        projectId: existing.projectId,
        documentNumber: existing.documentNumber,
        status: "sent_to_client",
        userId: actorId,
        printBaseUrl: baseUrl,
      });
    }

    await prisma.workDiarySignToken.updateMany({
      where: { workDiaryId: id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { raw, hash, publicId } = generateSignToken();
    await prisma.workDiarySignToken.create({
      data: {
        workDiaryId: id,
        tokenHash: hash,
        publicId,
        createdById: actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const url = buildSignUrl({
      baseUrl,
      kind: "work-diary",
      documentNumber: existing.documentNumber,
      publicId,
      rawToken: raw,
    });

    await notifyUsers(
      [existing.createdById, actorId],
      "יומן נשלח ללקוח",
      `${existing.documentNumber} נשלח לחתימה`,
      `/field/work-diaries/${id}`,
      existing.projectId
    );

    return { url, documentNumber: existing.documentNumber };
  },

  async getPublicForSign(documentNumber: string, tokenParam: string) {
    const { parseSignQuery } = await import("@/lib/documents/sign-tokens");
    const { buildDiaryPortal } = await import(
      "@/lib/share/client-portal-payload"
    );
    const parsed = parseSignQuery(tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.workDiarySignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        workDiary: { documentNumber, deletedAt: null },
      },
      include: {
        workDiary: { include: includeDetail },
        // createdBy may not exist on token — load separately if needed
      },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const mapped = mapDiary(token.workDiary);
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
    const portal = await buildDiaryPortal(mapped, {
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      sentBy,
      alreadySigned: Boolean(token.usedAt || token.workDiary.clientSignedAt),
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
    /** האם לשמור גרסה חתומה בארכיון המסמכים (ברירת מחדל: כן) */
    saveToDocuments?: boolean;
  }) {
    const { parseSignQuery } = await import("@/lib/documents/sign-tokens");
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

    const token = await prisma.workDiarySignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        usedAt: null,
        workDiary: { documentNumber: opts.documentNumber, deletedAt: null },
      },
      include: { workDiary: true },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const diary = token.workDiary;
    const signedAt = new Date();
    const verificationId = buildVerificationId(
      diary.documentNumber,
      token.publicId
    );
    const signedViewPath = `/sign/work-diary/${encodeURIComponent(diary.documentNumber)}/signed?t=${encodeURIComponent(opts.tokenParam)}`;

    await prisma.$transaction(async (tx) => {
      await tx.workDiarySignToken.update({
        where: { id: token.id },
        data: { usedAt: signedAt },
      });
      await tx.workDiary.update({
        where: { id: diary.id },
        data: {
          clientSignatureUrl: signatureDataUrl,
          clientSignedName: opts.signerName,
          clientSignedAt: signedAt,
          clientSignedIp: opts.ip ?? null,
          clientSignedDevice: opts.device ?? null,
          clientSignedVersion: diary.currentVersion,
          status: "signed",
          lockedAt: signedAt,
          signedPdfUrl: signedViewPath,
        },
      });
    });

    if (diary.workflowDocumentId) {
      try {
        await WorkflowRepository.transition({
          documentId: diary.workflowDocumentId,
          action: "client_signed",
          actor: {
            userId: diary.createdById,
            role: "CLIENT",
            name: opts.signerName,
          },
        });
      } catch {
        /* status may already allow signed via legacy path */
      }
      await syncWorkDiaryArchiveDocument({
        workflowDocumentId: diary.workflowDocumentId,
        workDiaryId: diary.id,
        projectId: diary.projectId,
        documentNumber: diary.documentNumber,
        status: "client_signed",
        userId: diary.createdById,
      });
    }

    if (opts.saveToDocuments !== false) {
      await archiveClientSignedDocument({
        kind: "work_diary",
        projectId: diary.projectId,
        entityId: diary.id,
        documentNumber: diary.documentNumber,
        userId: diary.createdById,
        signedViewPath,
        signerName: opts.signerName,
        signedAt,
        ip: opts.ip,
        device: opts.device,
        linkPublicId: token.publicId,
        verificationId,
      });
    }

    const approverIds = await prisma.workDiaryApproval
      .findMany({
        where: { workDiaryId: diary.id },
        select: { approverId: true },
      })
      .then((rows) => rows.map((r) => r.approverId));

    await notifyUsers(
      [diary.createdById, diary.updatedById, ...approverIds],
      "הלקוח חתם על יומן עבודה",
      `${diary.documentNumber} נחתם ע״י ${opts.signerName}`,
      signedViewPath,
      diary.projectId
    );

    const mapped = await this.getById(diary.id);
    return {
      ...mapped,
      verificationId,
      signedViewUrl: signedViewPath,
      signedPdfUrl: signedViewPath,
      alreadySigned: true,
    };
  },

  async listPendingApprovals(approverId: string) {
    const pending = await WorkflowRepository.listPendingForApprover(approverId);
    const diaryPending = pending.filter((p) => p.kind === "WORK_DIARY");
    if (!diaryPending.length) return [];

    const wfIds = diaryPending.map((p) => p.documentId);
    const diaries = await prisma.workDiary.findMany({
      where: {
        deletedAt: null,
        workflowDocumentId: { in: wfIds },
      },
      include: {
        project: { select: { id: true, name: true } },
        foreman: { select: { firstName: true, lastName: true } },
        workflowDocument: {
          include: {
            attachments: { select: { id: true, fileType: true }, take: 12 },
          },
        },
      },
    });

    const byWf = new Map(
      diaries
        .filter((d) => d.workflowDocumentId)
        .map((d) => [d.workflowDocumentId!, d])
    );

    return diaryPending
      .map((p) => {
        const diary = byWf.get(p.documentId);
        if (!diary) return null;
        const attachments = diary.workflowDocument?.attachments ?? [];
        const photoCount = attachments.filter((a) =>
          String(a.fileType || "").startsWith("image/")
        ).length;
        return {
          approvalId: p.approvalId,
          kind: "work_diary" as const,
          documentId: diary.id,
          documentNumber: diary.documentNumber,
          project: diary.project,
          projectName: diary.customSiteName || diary.project.name,
          projectId: diary.projectId,
          foremanName: `${diary.foreman.firstName} ${diary.foreman.lastName}`,
          workDate: diary.workDate.toISOString().slice(0, 10),
          workSummary: diary.workSummary,
          photoCount,
          sentAt: p.sentAt,
          status: p.status,
          version: diary.workflowDocument?.version,
          link: `/field/work-diaries/${diary.id}`,
        };
      })
      .filter(Boolean) as any[];
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
    },
    actorId?: string
  ) {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");
    if (!existing.workflowDocumentId) {
      throw new Error("יומן זה עדיין לא מחובר למנוע Workflow — יש להריץ מיגרציה");
    }
    if (!actorId) throw new Error("חסר מזהה משתמש להעלאה");

    const wfStatus = existing.workflowDocument
      ? (existing.workflowDocument.status as WorkflowStatus)
      : mapLegacyDiaryStatusToWorkflow(existing.status);
    if (!isEditableStatus("WORK_DIARY", wfStatus)) {
      throw new Error("לא ניתן להעלות קבצים במצב הנוכחי");
    }

    const actor = await actorFromUserId(actorId);
    await WorkflowRepository.addAttachment(
      existing.workflowDocumentId,
      {
        name: media.name,
        fileType: "image",
        extension: media.name.split(".").pop()?.toLowerCase() || "jpg",
        size: media.size ?? 0,
        bucket: media.bucket || "images",
        path: media.path || media.url,
        url: media.url,
      },
      actor
    );

    await prisma.workDiaryMedia.create({
      data: {
        workDiaryId: id,
        name: media.name,
        url: media.url,
        path: media.path ?? null,
        bucket: media.bucket ?? null,
        size: media.size ?? 0,
        stage: media.stage ?? "other",
      },
    });

    // Regenerate official PDF archive entry after media change
    await syncWorkDiaryArchiveDocument({
      workflowDocumentId: existing.workflowDocumentId,
      workDiaryId: id,
      projectId: existing.projectId,
      documentNumber: existing.documentNumber,
      status: wfStatus,
      userId: actorId,
      bumpVersion: true,
    }).catch(() => undefined);

    const diary = await this.getById(id);
    return (
      diary?.media?.[0] ?? {
        name: media.name,
        url: media.url,
        path: media.path,
        bucket: media.bucket,
        size: media.size ?? 0,
        stage: media.stage ?? "other",
      }
    );
  },

  async addAttachment(
    id: string,
    file: {
      name: string;
      mimeType: string;
      size: number;
      kind?: string;
      bucket: string;
      path: string;
      url: string;
    },
    actorId?: string
  ) {
    const existing = await prisma.workDiary.findFirst({
      where: { id, deletedAt: null },
      include: { workflowDocument: true },
    });
    if (!existing) throw new Error("יומן עבודה לא נמצא");
    if (!existing.workflowDocumentId) {
      throw new Error("יומן זה עדיין לא מחובר למנוע Workflow — יש להריץ מיגרציה");
    }
    if (!actorId) throw new Error("חסר מזהה משתמש להעלאה");

    const wfStatus = existing.workflowDocument
      ? (existing.workflowDocument.status as WorkflowStatus)
      : mapLegacyDiaryStatusToWorkflow(existing.status);
    if (!isEditableStatus("WORK_DIARY", wfStatus)) {
      throw new Error("לא ניתן לצרף קבצים במצב הנוכחי");
    }

    const actor = await actorFromUserId(actorId);
    await WorkflowRepository.addAttachment(
      existing.workflowDocumentId,
      {
        name: file.name,
        fileType: file.kind || file.mimeType || "document",
        extension: file.name.split(".").pop()?.toLowerCase() || "bin",
        size: file.size,
        bucket: file.bucket,
        path: file.path,
        url: file.url,
      },
      actor
    );

    const diary = await this.getById(id);
    return (
      diary?.attachments?.[0] ?? {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        kind: file.kind ?? "document",
        bucket: file.bucket,
        path: file.path,
        url: file.url,
      }
    );
  },

  /** מיגרציה חד-פעמית: יומנים קיימים → WorkflowDocument */
  async migrateToWorkflowEngine() {
    const rows = await prisma.workDiary.findMany({
      where: { workflowDocumentId: null, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    let created = 0;
    for (const row of rows) {
      const actor = await actorFromUserId(row.createdById);
      const status = mapLegacyDiaryStatusToWorkflow(row.status);
      const wf = await WorkflowRepository.create({
        kind: "WORK_DIARY",
        projectId: row.projectId,
        title: `יומן עבודה ${row.documentNumber}`,
        documentNumber: row.documentNumber,
        legacyEntityType: "WorkDiary",
        legacyEntityId: row.id,
        currentOwnerId: row.createdById,
        actor,
      });
      if (status !== "draft") {
        await prisma.workflowDocument.update({
          where: { id: wf.id },
          data: {
            status: status as any,
            clientSignatureStatus:
              status === "client_signed" ? "signed" : undefined,
          },
        });
      }
      await prisma.workDiary.update({
        where: { id: row.id },
        data: { workflowDocumentId: wf.id },
      });
      await syncWorkDiaryArchiveDocument({
        workflowDocumentId: wf.id,
        workDiaryId: row.id,
        projectId: row.projectId,
        documentNumber: row.documentNumber,
        status,
        userId: row.createdById,
      });
      created += 1;
    }
    return { total: rows.length, created };
  },
};
