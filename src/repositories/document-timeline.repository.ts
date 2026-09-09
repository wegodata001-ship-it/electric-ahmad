import { prisma } from "@/lib/prisma";
import {
  FIELD_MANAGER_ROLE,
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
  TRUCK_DRIVER_ROLE,
} from "@/lib/auth/roles";
import { canSeeAllProjects } from "@/lib/auth/project-access";
import type { TimelineSession } from "@/lib/auth/timeline-session";

export type TimelineDocumentKind =
  | "work_diary"
  | "delivery_note"
  | "measurement"
  | "invoice";

export type TimelineTone =
  | "green"
  | "orange"
  | "red"
  | "blue"
  | "gray";

export type TimelineCategory =
  | "approved"
  | "pending"
  | "revision"
  | "signed"
  | "created"
  | "updated"
  | "info";

export type DocumentTimelineEvent = {
  id: string;
  source:
    | "workflow"
    | "document_event"
    | "approval"
    | "audit"
    | "version"
    | "record";
  sourceId: string;
  documentKey: string;
  workflowDocumentId: string | null;
  kind: TimelineDocumentKind;
  documentId: string;
  documentNumber: string;
  title: string;
  projectId: string | null;
  projectName: string;
  action: string;
  message: string;
  category: TimelineCategory;
  tone: TimelineTone;
  status: string | null;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  occurredAt: string;
  documentUrl: string;
  createdById: string | null;
  priority: number;
};

export type TimelineFilters = {
  projectId?: string;
  kind?: TimelineDocumentKind;
  category?: TimelineCategory;
  period?: "1" | "7" | "30" | "90" | "all";
  query?: string;
  documentKey?: string;
  take?: number;
};

type EventInput = Omit<
  DocumentTimelineEvent,
  "category" | "tone" | "occurredAt"
> & {
  category?: TimelineCategory;
  tone?: TimelineTone;
  occurredAt: Date;
};

function kindFromWorkflow(kind: string): TimelineDocumentKind | null {
  if (kind === "WORK_DIARY") return "work_diary";
  if (kind === "DELIVERY_NOTE") return "delivery_note";
  if (kind === "MEASUREMENT" || kind === "EXECUTION_REPORT") {
    return "measurement";
  }
  if (kind === "ACCOUNT" || kind === "INVOICE") return "invoice";
  return null;
}

function categoryFor(value: string): TimelineCategory {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("reject") ||
    normalized.includes("revision") ||
    normalized.includes("return") ||
    normalized.includes("תיקון") ||
    normalized.includes("נדח")
  ) {
    return "revision";
  }
  if (
    normalized.includes("client_signed") ||
    normalized.includes("receiver_signed") ||
    normalized.includes("signed") ||
    normalized.includes("נחתם")
  ) {
    return "signed";
  }
  if (
    normalized.includes("approve") ||
    normalized.includes("complete") ||
    normalized.includes("locked") ||
    normalized.includes("אושר") ||
    normalized.includes("הושלם")
  ) {
    return "approved";
  }
  if (
    normalized.includes("submit") ||
    normalized.includes("pending") ||
    normalized.includes("sent_for_approval") ||
    normalized.includes("נשלח לאישור") ||
    normalized.includes("ממתין")
  ) {
    return "pending";
  }
  if (
    normalized.includes("created") ||
    normalized === "create" ||
    normalized.includes("נוצר")
  ) {
    return "created";
  }
  if (
    normalized.includes("updated") ||
    normalized.includes("edited") ||
    normalized.includes("saved") ||
    normalized.includes("נערך") ||
    normalized.includes("נשמר")
  ) {
    return "updated";
  }
  return "info";
}

function toneFor(category: TimelineCategory): TimelineTone {
  if (category === "approved" || category === "signed") return "green";
  if (category === "pending") return "orange";
  if (category === "revision") return "red";
  if (category === "created" || category === "updated") return "blue";
  return "gray";
}

function normalizedEvent(input: EventInput): DocumentTimelineEvent {
  const category =
    input.category ??
    categoryFor(`${input.action} ${input.message} ${input.status ?? ""}`);
  return {
    ...input,
    category,
    tone: input.tone ?? toneFor(category),
    occurredAt: input.occurredAt.toISOString(),
  };
}

function parseNote(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const value =
      parsed.comment ??
      parsed.note ??
      parsed.reason ??
      parsed.returnComment ??
      parsed.correctionReason;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function parseMetadata(metadata: string | null | undefined) {
  if (!metadata) return {} as Record<string, unknown>;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function periodStart(period: TimelineFilters["period"]): Date | undefined {
  if (!period || period === "all") return undefined;
  if (period === "1") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = Number(period);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function dedupe(events: DocumentTimelineEvent[]) {
  const selected = new Map<string, DocumentTimelineEvent>();
  for (const event of events) {
    const minute = event.occurredAt.slice(0, 16);
    const key = [
      event.documentKey,
      event.category,
      canonicalAction(event.action),
      minute,
    ].join(":");
    const current = selected.get(key);
    if (!current || event.priority > current.priority) selected.set(key, event);
  }
  return [...selected.values()];
}

function canonicalAction(action: string) {
  const value = action.toLowerCase();
  if (["create", "created"].includes(value)) return "created";
  if (["update", "updated", "saved", "edited"].includes(value)) return "updated";
  if (value.includes("submit") || value.includes("approval_requested")) {
    return "submitted";
  }
  if (value.includes("approve")) return "approved";
  if (
    value.includes("reject") ||
    value.includes("revision") ||
    value.includes("correction")
  ) {
    return "revision";
  }
  if (value.includes("signed")) return "signed";
  return value.replace(/[^a-z0-9א-ת]/gi, "");
}

async function allowedProjectIds(session: TimelineSession) {
  if (canSeeAllProjects(session.role)) return null;
  if (session.role === PROJECT_MANAGER_ROLE) {
    const rows = await prisma.project.findMany({
      where: { ownerId: session.userId, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }
  if (session.role === FIELD_MANAGER_ROLE && session.employeeId) {
    const rows = await prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { foremanId: session.employeeId },
          { employees: { some: { employeeId: session.employeeId } } },
        ],
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }
  return new Set<string>();
}

async function fieldAllowedDocumentKeys(session: TimelineSession) {
  if (session.role !== FIELD_MANAGER_ROLE || !session.employeeId) return null;
  const [diaries, deliveryNotes, measurements] = await Promise.all([
    prisma.workDiary.findMany({
      where: { foremanId: session.employeeId, deletedAt: null },
      select: { id: true },
    }),
    prisma.opsDeliveryNote.findMany({
      where: { foremanId: session.employeeId, deletedAt: null },
      select: { id: true },
    }),
    prisma.measurementSheet.findMany({
      where: {
        approvals: {
          some: { approverId: session.userId, status: "pending" },
        },
      },
      select: { id: true },
    }),
  ]);
  return new Set([
    ...diaries.map((row) => `work_diary:${row.id}`),
    ...deliveryNotes.map((row) => `delivery_note:${row.id}`),
    ...measurements.map((row) => `measurement:${row.id}`),
  ]);
}

export function canViewTimelineEvent(
  event: DocumentTimelineEvent,
  session: TimelineSession,
  projects: Set<string> | null,
  fieldDocumentKeys?: ReadonlySet<string> | null
) {
  if (projects === null) return true;
  if (session.role === TRUCK_DRIVER_ROLE || session.role === "נהג") {
    return (
      event.kind === "delivery_note" &&
      event.createdById === session.userId
    );
  }
  if (session.role === FIELD_MANAGER_ROLE) {
    return fieldDocumentKeys
      ? fieldDocumentKeys.has(event.documentKey)
      : (event.kind === "work_diary" || event.kind === "delivery_note") &&
          event.createdById === session.userId;
  }
  if (event.projectId && projects.has(event.projectId)) return true;
  if (
    session.role === PROJECT_MANAGER_ROLE &&
    (event.kind === "work_diary" || event.kind === "delivery_note") &&
    event.createdById === session.userId
  ) {
    return true;
  }
  return false;
}

function documentUrlForSession(
  event: DocumentTimelineEvent,
  session: TimelineSession
) {
  if (session.role === FIELD_MANAGER_ROLE) {
    if (event.kind === "work_diary") {
      return `/field/work-diaries/${event.documentId}`;
    }
    if (event.kind === "delivery_note") {
      return `/field/delivery-notes/${event.documentId}`;
    }
    if (event.kind === "measurement") {
      return `/field/approvals/review/measurement_sheet/${event.documentId}`;
    }
  }
  if (
    (session.role === TRUCK_DRIVER_ROLE || session.role === "נהג") &&
    event.kind === "delivery_note"
  ) {
    return `/driver/delivery-notes/${event.documentId}`;
  }
  if (
    event.kind === "delivery_note" &&
    event.documentUrl.startsWith("/delivery-notes/")
  ) {
    return event.documentUrl;
  }
  if (event.kind === "invoice") return `/invoices/${event.documentId}`;
  const portal =
    session.role === OPERATIONS_MANAGER_ROLE
      ? "operations"
      : session.role === PROJECT_MANAGER_ROLE
        ? "project"
        : "system";
  const reviewKind =
    event.kind === "work_diary"
      ? "work_diary"
      : event.kind === "delivery_note"
        ? "delivery_note"
        : "measurement_sheet";
  return `/${portal}/approvals/review/${reviewKind}/${event.documentId}`;
}

function matchesFilters(
  event: DocumentTimelineEvent,
  filters: TimelineFilters
) {
  if (filters.documentKey && event.documentKey !== filters.documentKey) {
    return false;
  }
  if (filters.projectId && event.projectId !== filters.projectId) return false;
  if (filters.kind && event.kind !== filters.kind) return false;
  if (filters.category && event.category !== filters.category) return false;
  const query = filters.query?.trim().toLowerCase();
  if (
    query &&
    ![
      event.documentNumber,
      event.title,
      event.projectName,
      event.actorName,
      event.message,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  ) {
    return false;
  }
  return true;
}

export class DocumentTimelineRepository {
  static async list(session: TimelineSession, filters: TimelineFilters = {}) {
    const since = periodStart(filters.period);
    const dateWhere = since ? { gte: since } : undefined;
    const sourceTake = Math.min(Math.max((filters.take ?? 250) * 2, 300), 1000);
    const [
      workflowEvents,
      diaryEvents,
      deliveryEvents,
      measurementEvents,
      workflowApprovals,
      diaryApprovals,
      deliveryApprovals,
      measurementApprovals,
      invoices,
      invoiceApprovals,
      standardNotes,
      auditLogs,
    ] = await Promise.all([
      prisma.workflowEvent.findMany({
        where: { createdAt: dateWhere },
        include: {
          actor: { select: { id: true, name: true } },
          document: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.workDiaryEvent.findMany({
        where: {
          createdAt: dateWhere,
          workDiary: { workflowDocumentId: null, deletedAt: null },
        },
        include: {
          actor: { select: { id: true, name: true } },
          workDiary: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.opsDeliveryNoteEvent.findMany({
        where: { createdAt: dateWhere, opsDeliveryNote: { deletedAt: null } },
        include: {
          actor: { select: { id: true, name: true } },
          opsDeliveryNote: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.measurementSheetEvent.findMany({
        where: { createdAt: dateWhere },
        include: {
          actor: { select: { id: true, name: true } },
          sheet: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.workflowApproval.findMany({
        where: since
          ? { OR: [{ sentAt: { gte: since } }, { decidedAt: { gte: since } }] }
          : {},
        include: {
          approver: { select: { id: true, name: true } },
          document: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.workDiaryApproval.findMany({
        where: since
          ? { OR: [{ sentAt: { gte: since } }, { decidedAt: { gte: since } }] }
          : {},
        include: {
          approver: { select: { id: true, name: true } },
          workDiary: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.opsDeliveryNoteApproval.findMany({
        where: since
          ? { OR: [{ sentAt: { gte: since } }, { decidedAt: { gte: since } }] }
          : {},
        include: {
          approver: { select: { id: true, name: true } },
          opsDeliveryNote: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.measurementSheetApproval.findMany({
        where: since
          ? { OR: [{ sentAt: { gte: since } }, { decidedAt: { gte: since } }] }
          : {},
        include: {
          approver: { select: { id: true, name: true } },
          sheet: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.partialInvoice.findMany({
        where: { createdAt: dateWhere },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.projectInvoiceApproval.findMany({
        where: since
          ? {
              OR: [
                { sentAt: { gte: since } },
                { approvedAt: { gte: since } },
                { rejectedAt: { gte: since } },
              ],
            }
          : {},
        include: {
          invoice: true,
          project: { select: { id: true, name: true } },
          approverUser: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.deliveryNote.findMany({
        where: { createdAt: dateWhere },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          versions: {
            where: { createdAt: dateWhere },
            include: { editedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
      prisma.auditLog.findMany({
        where: {
          createdAt: dateWhere,
          entityType: {
            in: [
              "WorkDiary",
              "OpsDeliveryNote",
              "MeasurementSheet",
              "PartialInvoice",
              "DeliveryNote",
            ],
          },
        },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: sourceTake,
      }),
    ]);

    const events: DocumentTimelineEvent[] = [];
    const push = (input: EventInput) => events.push(normalizedEvent(input));

    for (const row of workflowEvents) {
      const kind = kindFromWorkflow(row.document.kind);
      if (!kind) continue;
      const documentId =
        row.document.legacyEntityId ?? row.document.sourceDocumentId ?? row.document.id;
      push({
        id: `workflow:${row.id}`,
        source: "workflow",
        sourceId: row.id,
        documentKey: `${kind}:${documentId}`,
        workflowDocumentId: row.documentId,
        kind,
        documentId,
        documentNumber: row.document.documentNumber,
        title: row.document.title ?? row.document.documentNumber,
        projectId: row.document.projectId,
        projectName: row.document.project.name,
        action: row.type,
        message: row.message,
        status: row.toStatus,
        actorId: row.actor?.id ?? null,
        actorName: row.actor?.name ?? null,
        note: parseNote(row.metadata),
        occurredAt: row.createdAt,
        documentUrl: this.documentUrl(kind, documentId),
        createdById: row.document.createdById,
        priority: 5,
      });
    }

    for (const row of diaryEvents) {
      const doc = row.workDiary;
      push({
        id: `diary:${row.id}`,
        source: "document_event",
        sourceId: row.id,
        documentKey: `work_diary:${doc.id}`,
        workflowDocumentId: doc.workflowDocumentId,
        kind: "work_diary",
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        title: `יומן עבודה ${doc.documentNumber}`,
        projectId: doc.projectId,
        projectName: doc.project.name,
        action: row.action,
        message: row.message,
        status: doc.status,
        actorId: row.actor?.id ?? null,
        actorName: row.actor?.name ?? null,
        note: parseNote(row.metadata),
        occurredAt: row.createdAt,
        documentUrl: this.documentUrl("work_diary", doc.id),
        createdById: doc.createdById,
        priority: 4,
      });
    }

    for (const row of deliveryEvents) {
      const doc = row.opsDeliveryNote;
      push({
        id: `delivery:${row.id}`,
        source: "document_event",
        sourceId: row.id,
        documentKey: `delivery_note:${doc.id}`,
        workflowDocumentId: null,
        kind: "delivery_note",
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        title: `תעודת משלוח ${doc.documentNumber}`,
        projectId: doc.projectId,
        projectName: doc.project?.name ?? "ללא פרויקט",
        action: row.action,
        message: row.message,
        status: doc.status,
        actorId: row.actor?.id ?? null,
        actorName: row.actor?.name ?? null,
        note: parseNote(row.metadata),
        occurredAt: row.createdAt,
        documentUrl: this.documentUrl("delivery_note", doc.id),
        createdById: doc.createdById,
        priority: 4,
      });
    }

    for (const row of measurementEvents) {
      const doc = row.sheet;
      push({
        id: `measurement:${row.id}`,
        source: "document_event",
        sourceId: row.id,
        documentKey: `measurement:${doc.id}`,
        workflowDocumentId: null,
        kind: "measurement",
        documentId: doc.id,
        documentNumber: `MS-${doc.sequenceNumber}`,
        title: doc.title,
        projectId: doc.projectId,
        projectName: doc.project.name,
        action: row.type,
        message: row.message,
        status: doc.status,
        actorId: row.actor.id,
        actorName: row.actor.name,
        note: parseNote(row.metadata),
        occurredAt: row.createdAt,
        documentUrl: this.documentUrl("measurement", doc.id),
        createdById: doc.createdById,
        priority: 4,
      });
    }

    const addApprovalEvents = (input: {
      id: string;
      kind: TimelineDocumentKind;
      documentId: string;
      workflowDocumentId?: string | null;
      documentNumber: string;
      title: string;
      projectId: string | null;
      projectName: string;
      createdById: string;
      approverId: string | null;
      approverName: string | null;
      status: string;
      comment: string | null;
      sentAt: Date | null;
      decidedAt: Date | null;
    }) => {
      if (input.sentAt) {
        push({
          id: `approval:${input.id}:sent`,
          source: "approval",
          sourceId: input.id,
          documentKey: `${input.kind}:${input.documentId}`,
          workflowDocumentId: input.workflowDocumentId ?? null,
          kind: input.kind,
          documentId: input.documentId,
          documentNumber: input.documentNumber,
          title: input.title,
          projectId: input.projectId,
          projectName: input.projectName,
          action: "approver_added",
          message: `נוסף מאשר למסמך ${input.documentNumber}`,
          category: "pending",
          status: "pending",
          actorId: input.approverId,
          actorName: input.approverName,
          note: null,
          occurredAt: input.sentAt,
          documentUrl: this.documentUrl(input.kind, input.documentId),
          createdById: input.createdById,
          priority: 2,
        });
      }
      if (input.decidedAt) {
        const approved = input.status === "approved";
        push({
          id: `approval:${input.id}:decided`,
          source: "approval",
          sourceId: input.id,
          documentKey: `${input.kind}:${input.documentId}`,
          workflowDocumentId: input.workflowDocumentId ?? null,
          kind: input.kind,
          documentId: input.documentId,
          documentNumber: input.documentNumber,
          title: input.title,
          projectId: input.projectId,
          projectName: input.projectName,
          action: approved ? "approved" : "rejected",
          message: approved
            ? `${input.documentNumber} אושר`
            : `${input.documentNumber} הוחזר לתיקון`,
          category: approved ? "approved" : "revision",
          status: input.status,
          actorId: input.approverId,
          actorName: input.approverName,
          note: input.comment,
          occurredAt: input.decidedAt,
          documentUrl: this.documentUrl(input.kind, input.documentId),
          createdById: input.createdById,
          priority: 3,
        });
      }
    };

    for (const row of workflowApprovals) {
      const kind = kindFromWorkflow(row.document.kind);
      if (!kind) continue;
      const documentId =
        row.document.legacyEntityId ?? row.document.sourceDocumentId ?? row.document.id;
      addApprovalEvents({
        id: row.id,
        kind,
        documentId,
        workflowDocumentId: row.documentId,
        documentNumber: row.document.documentNumber,
        title: row.document.title ?? row.document.documentNumber,
        projectId: row.document.projectId,
        projectName: row.document.project.name,
        createdById: row.document.createdById,
        approverId: row.approver.id,
        approverName: row.approver.name,
        status: row.status,
        comment: row.comment,
        sentAt: row.sentAt,
        decidedAt: row.decidedAt,
      });
    }
    for (const row of diaryApprovals) {
      addApprovalEvents({
        id: row.id,
        kind: "work_diary",
        documentId: row.workDiaryId,
        workflowDocumentId: row.workDiary.workflowDocumentId,
        documentNumber: row.workDiary.documentNumber,
        title: `יומן עבודה ${row.workDiary.documentNumber}`,
        projectId: row.workDiary.projectId,
        projectName: row.workDiary.project.name,
        createdById: row.workDiary.createdById,
        approverId: row.approver.id,
        approverName: row.approver.name,
        status: row.status,
        comment: row.comment,
        sentAt: row.sentAt,
        decidedAt: row.decidedAt,
      });
    }
    for (const row of deliveryApprovals) {
      addApprovalEvents({
        id: row.id,
        kind: "delivery_note",
        documentId: row.opsDeliveryNoteId,
        documentNumber: row.opsDeliveryNote.documentNumber,
        title: `תעודת משלוח ${row.opsDeliveryNote.documentNumber}`,
        projectId: row.opsDeliveryNote.projectId,
        projectName: row.opsDeliveryNote.project?.name ?? "ללא פרויקט",
        createdById: row.opsDeliveryNote.createdById,
        approverId: row.approver.id,
        approverName: row.approver.name,
        status: row.status,
        comment: row.comment,
        sentAt: row.sentAt,
        decidedAt: row.decidedAt,
      });
    }
    for (const row of measurementApprovals) {
      addApprovalEvents({
        id: row.id,
        kind: "measurement",
        documentId: row.sheetId,
        documentNumber: `MS-${row.sheet.sequenceNumber}`,
        title: row.sheet.title,
        projectId: row.sheet.projectId,
        projectName: row.sheet.project.name,
        createdById: row.sheet.createdById,
        approverId: row.approver.id,
        approverName: row.approver.name,
        status: row.status,
        comment: row.comment,
        sentAt: row.sentAt,
        decidedAt: row.decidedAt,
      });
    }

    for (const invoice of invoices) {
      push({
        id: `invoice:${invoice.id}:created`,
        source: "record",
        sourceId: invoice.id,
        documentKey: `invoice:${invoice.id}`,
        workflowDocumentId: null,
        kind: "invoice",
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        title: `חשבון ${invoice.invoiceNumber}`,
        projectId: invoice.projectId,
        projectName: invoice.project.name,
        action: "created",
        message: `חשבון ${invoice.invoiceNumber} הופק`,
        category: "created",
        status: invoice.status,
        actorId: invoice.createdBy.id,
        actorName: invoice.createdBy.name,
        note: null,
        occurredAt: invoice.createdAt,
        documentUrl: this.documentUrl("invoice", invoice.id),
        createdById: invoice.createdById,
        priority: 1,
      });
    }
    for (const row of invoiceApprovals) {
      const decidedAt = row.approvedAt ?? row.rejectedAt;
      addApprovalEvents({
        id: row.id,
        kind: "invoice",
        documentId: row.invoiceId,
        documentNumber: row.invoice.invoiceNumber,
        title: `חשבון ${row.invoice.invoiceNumber}`,
        projectId: row.projectId,
        projectName: row.project.name,
        createdById: row.invoice.createdById,
        approverId: row.approverUser?.id ?? null,
        approverName: row.approverUser?.name ?? null,
        status: row.status,
        comment: row.comment,
        sentAt: row.sentAt,
        decidedAt,
      });
    }

    for (const note of standardNotes) {
      push({
        id: `standard-dn:${note.id}:created`,
        source: "record",
        sourceId: note.id,
        documentKey: `delivery_note:${note.id}`,
        workflowDocumentId: null,
        kind: "delivery_note",
        documentId: note.id,
        documentNumber: note.noteNumber,
        title: `תעודת משלוח ${note.noteNumber}`,
        projectId: note.projectId,
        projectName: note.project?.name ?? "ללא פרויקט",
        action: "created",
        message: `תעודת משלוח ${note.noteNumber} נוצרה`,
        category: "created",
        status: note.status,
        actorId: note.createdBy.id,
        actorName: note.createdBy.name,
        note: null,
        occurredAt: note.createdAt,
        documentUrl: `/delivery-notes/${note.id}`,
        createdById: note.createdById,
        priority: 1,
      });
      for (const version of note.versions) {
        push({
          id: `standard-dn-version:${version.id}`,
          source: "version",
          sourceId: version.id,
          documentKey: `delivery_note:${note.id}`,
          workflowDocumentId: null,
          kind: "delivery_note",
          documentId: note.id,
          documentNumber: note.noteNumber,
          title: `תעודת משלוח ${note.noteNumber}`,
          projectId: note.projectId,
          projectName: note.project?.name ?? "ללא פרויקט",
          action: "updated",
          message: `${note.noteNumber} נערך · גרסה ${version.version}`,
          category: "updated",
          status: note.status,
          actorId: version.editedBy.id,
          actorName: version.editedBy.name,
          note: null,
          occurredAt: version.createdAt,
          documentUrl: `/delivery-notes/${note.id}`,
          createdById: note.createdById,
          priority: 2,
        });
      }
    }

    const auditIds = (entityType: string) =>
      auditLogs
        .filter((log) => log.entityType === entityType)
        .map((log) => log.entityId);
    const [
      auditDiaries,
      auditDeliveryNotes,
      auditMeasurements,
      auditInvoices,
      auditStandardNotes,
    ] = await Promise.all([
      prisma.workDiary.findMany({
        where: { id: { in: auditIds("WorkDiary") }, deletedAt: null },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.opsDeliveryNote.findMany({
        where: { id: { in: auditIds("OpsDeliveryNote") }, deletedAt: null },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.measurementSheet.findMany({
        where: { id: { in: auditIds("MeasurementSheet") } },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.partialInvoice.findMany({
        where: { id: { in: auditIds("PartialInvoice") } },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.deliveryNote.findMany({
        where: { id: { in: auditIds("DeliveryNote") } },
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);

    type AuditDocument = {
      kind: TimelineDocumentKind;
      id: string;
      number: string;
      title: string;
      projectId: string | null;
      projectName: string;
      status: string;
      createdById: string;
      workflowDocumentId?: string | null;
      url?: string;
    };
    const auditDocuments = new Map<string, AuditDocument>();
    for (const doc of auditDiaries) {
      auditDocuments.set(`WorkDiary:${doc.id}`, {
        kind: "work_diary",
        id: doc.id,
        number: doc.documentNumber,
        title: `יומן עבודה ${doc.documentNumber}`,
        projectId: doc.projectId,
        projectName: doc.project.name,
        status: doc.status,
        createdById: doc.createdById,
        workflowDocumentId: doc.workflowDocumentId,
      });
    }
    for (const doc of auditDeliveryNotes) {
      auditDocuments.set(`OpsDeliveryNote:${doc.id}`, {
        kind: "delivery_note",
        id: doc.id,
        number: doc.documentNumber,
        title: `תעודת משלוח ${doc.documentNumber}`,
        projectId: doc.projectId,
        projectName: doc.project?.name ?? "ללא פרויקט",
        status: doc.status,
        createdById: doc.createdById,
      });
    }
    for (const doc of auditMeasurements) {
      auditDocuments.set(`MeasurementSheet:${doc.id}`, {
        kind: "measurement",
        id: doc.id,
        number: `MS-${doc.sequenceNumber}`,
        title: doc.title,
        projectId: doc.projectId,
        projectName: doc.project.name,
        status: doc.status,
        createdById: doc.createdById,
      });
    }
    for (const doc of auditInvoices) {
      auditDocuments.set(`PartialInvoice:${doc.id}`, {
        kind: "invoice",
        id: doc.id,
        number: doc.invoiceNumber,
        title: `חשבון ${doc.invoiceNumber}`,
        projectId: doc.projectId,
        projectName: doc.project.name,
        status: doc.status,
        createdById: doc.createdById,
      });
    }
    for (const doc of auditStandardNotes) {
      auditDocuments.set(`DeliveryNote:${doc.id}`, {
        kind: "delivery_note",
        id: doc.id,
        number: doc.noteNumber,
        title: `תעודת משלוח ${doc.noteNumber}`,
        projectId: doc.projectId,
        projectName: doc.project?.name ?? "ללא פרויקט",
        status: doc.status,
        createdById: doc.createdById,
        url: `/delivery-notes/${doc.id}`,
      });
    }

    for (const log of auditLogs) {
      const doc = auditDocuments.get(`${log.entityType}:${log.entityId}`);
      if (!doc) continue;
      const metadata = parseMetadata(log.metadata);
      const action =
        typeof metadata.action === "string"
          ? metadata.action
          : log.action.toLowerCase();
      const category = categoryFor(action);
      const actionLabel =
        category === "created"
          ? "נוצר"
          : category === "updated"
            ? "עודכן"
            : category === "pending"
              ? "נשלח לאישור"
              : category === "approved"
                ? "אושר"
                : category === "revision"
                  ? "הוחזר לתיקון"
                  : category === "signed"
                    ? "נחתם"
                    : "תועד במערכת";
      push({
        id: `audit:${log.id}`,
        source: "audit",
        sourceId: log.id,
        documentKey: `${doc.kind}:${doc.id}`,
        workflowDocumentId: doc.workflowDocumentId ?? null,
        kind: doc.kind,
        documentId: doc.id,
        documentNumber: doc.number,
        title: doc.title,
        projectId: doc.projectId,
        projectName: doc.projectName,
        action,
        message: `${doc.number} ${actionLabel}`,
        category,
        status: doc.status,
        actorId: log.user.id,
        actorName: log.user.name,
        note: parseNote(log.metadata),
        occurredAt: log.createdAt,
        documentUrl: doc.url ?? this.documentUrl(doc.kind, doc.id),
        createdById: doc.createdById,
        priority: 1,
      });
    }

    const [projects, fieldKeys] = await Promise.all([
      allowedProjectIds(session),
      fieldAllowedDocumentKeys(session),
    ]);
    const visible = dedupe(events)
      .filter((event) =>
        canViewTimelineEvent(event, session, projects, fieldKeys)
      )
      .filter((event) => matchesFilters(event, filters))
      .map((event) => ({
        ...event,
        documentUrl: documentUrlForSession(event, session),
      }))
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() -
          new Date(a.occurredAt).getTime()
      );
    const take = Math.min(Math.max(filters.take ?? 250, 1), 500);
    const items = visible.slice(0, take);

    const projectOptions = [
      ...new Map(
        dedupe(events)
          .filter((event) =>
            canViewTimelineEvent(event, session, projects, fieldKeys)
          )
          .filter((event) => event.projectId)
          .map((event) => [
            event.projectId as string,
            { id: event.projectId as string, name: event.projectName },
          ])
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name, "he"));

    const todayKey = new Date().toLocaleDateString("en-CA");
    const latestByDocument = new Map<string, DocumentTimelineEvent>();
    for (const event of visible) {
      if (!latestByDocument.has(event.documentKey)) {
        latestByDocument.set(event.documentKey, event);
      }
    }
    const latest = [...latestByDocument.values()];

    return {
      items,
      projects: projectOptions,
      summary: {
        pending: latest.filter((event) => event.category === "pending").length,
        revision: latest.filter((event) => event.category === "revision").length,
        approvedToday: visible.filter(
          (event) =>
            event.category === "approved" &&
            new Date(event.occurredAt).toLocaleDateString("en-CA") === todayKey
        ).length,
        actionsToday: visible.filter(
          (event) =>
            new Date(event.occurredAt).toLocaleDateString("en-CA") === todayKey
        ).length,
      },
    };
  }

  private static documentUrl(kind: TimelineDocumentKind, id: string) {
    if (kind === "work_diary") return `/print/work-diaries/${id}`;
    if (kind === "delivery_note") return `/print/ops-delivery-notes/${id}`;
    if (kind === "measurement") return `/invoices/sheets/${id}`;
    return `/partial-invoices/${id}`;
  }
}
