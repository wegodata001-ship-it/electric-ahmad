import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import {
  buildSignUrl,
  generateSignToken,
  hashSignToken,
  parseSignQuery,
} from "@/lib/documents/sign-tokens";
import type { MeasurementAxisType, MeasurementSheetStatus } from "@prisma/client";
import {
  assertDocumentMutable,
  MEASUREMENT_EDITABLE_STATUSES,
} from "@/lib/workflow/document-guards";
import {
  assertProjectManagerPendingEdit,
  canProjectManagerEditPendingSheet,
  PmApprovalEditError,
} from "@/lib/auth/measurement-pm-approval-edit";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

function num(v: unknown): number {
  return Number(v ?? 0);
}

function newEntityId() {
  return randomUUID().replace(/-/g, "");
}

export type CellSaveOfficeResult =
  | {
      status: "ok";
      saved: number;
      cells: {
        id: string;
        rowId: string;
        boqItemId: string;
        quantity: number;
      }[];
      currentVersion?: number;
    }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "locked" }
  | { status: "conflict"; message: string };

const sheetInclude = {
  rows: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      projectRoom: {
        select: {
          id: true,
          name: true,
          floor: true,
          code: true,
          sortOrder: true,
          isHidden: true,
          deletedAt: true,
        },
      },
    },
  },
  cells: {
    include: {
      boqItem: {
        select: {
          id: true,
          code: true,
          description: true,
          unit: true,
          contractQuantity: true,
          completedQuantity: true,
          unitPrice: true,
          invoicedQuantity: true,
          remainingQuantity: true,
          deletedAt: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      contractor: true,
      location: true,
      measurementAxisType: true,
      measurementAxisLabel: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  approvals: {
    orderBy: { createdAt: "desc" as const },
    include: { approver: { select: { id: true, name: true, role: true } } },
  },
  reviewNotes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 40,
    include: { actor: { select: { id: true, name: true } } },
  },
  versions: { orderBy: { version: "desc" as const }, take: 20 },
} as const;

function isSheetEditable(status: MeasurementSheetStatus): boolean {
  return status === "draft" || status === "in_progress" || status === "revision";
}

function documentFolderForStatus(status: MeasurementSheetStatus): string {
  switch (status) {
    case "pending_approval":
      return "דוחות ביצוע/ממתין לאישור";
    case "revision":
      return "דוחות ביצוע/דורש תיקון";
    case "approved":
    case "locked":
      return "דוחות ביצוע/מאושר";
    case "invoiced":
      return "דוחות ביצוע/הופק לחשבון";
    case "draft":
    case "in_progress":
    default:
      return "דוחות ביצוע/טיוטות";
  }
}

function asDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function iso(v: unknown): string | null {
  const d = asDate(v);
  return d ? d.toISOString() : null;
}

function parseJsonArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapSheet(row: any) {
  const rows = parseJsonArray(row.rows);
  const cells = parseJsonArray(row.cells);
  const approvals = parseJsonArray(row.approvals);
  const reviewNotes = parseJsonArray(row.reviewNotes);
  const events = parseJsonArray(row.events);
  const versions = parseJsonArray(row.versions);

  const mappedRows = rows
    .filter((r: any) => {
      if (r.projectRoom?.deletedAt) return false;
      if (r.projectRoom?.isHidden) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const sa = a.projectRoom?.sortOrder ?? a.sortOrder ?? 0;
      const sb = b.projectRoom?.sortOrder ?? b.sortOrder ?? 0;
      return sa - sb;
    })
    .map((r: any) => ({
      id: r.id,
      name: r.projectRoom?.name ?? r.name,
      sortOrder: r.projectRoom?.sortOrder ?? r.sortOrder,
      notes: r.notes,
      projectRoomId: r.projectRoomId ?? r.projectRoom?.id ?? null,
      floor: r.projectRoom?.floor ?? null,
      code: r.projectRoom?.code ?? null,
      isHidden: r.projectRoom?.isHidden ?? false,
    }));

  const rowNameById = new Map(mappedRows.map((r) => [r.id, r.name]));

  const rejectedSorted = approvals
    .filter((a: any) => a.status === "rejected")
    .sort(
      (a: any, b: any) =>
        (asDate(b.decidedAt)?.getTime() ?? 0) -
        (asDate(a.decidedAt)?.getTime() ?? 0)
    );
  const lastReject = rejectedSorted[0] ?? null;

  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    sequenceNumber: row.sequenceNumber,
    status: row.status as MeasurementSheetStatus,
    notes: row.notes,
    currentVersion: row.currentVersion ?? 1,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    returnedAt: iso(row.returnedAt),
    lastReturnComment: row.lastReturnComment ?? null,
    returnedByName: lastReject?.approver?.name ?? null,
    returnedById: lastReject?.approverId ?? null,
    partialInvoiceId: row.partialInvoiceId,
    invoiceNumber: row.invoiceNumber ?? row.partialInvoice?.invoiceNumber ?? null,
    clientSignatureUrl: row.clientSignatureUrl ?? null,
    clientSignedName: row.clientSignedName ?? null,
    clientSignedAt: iso(row.clientSignedAt),
    documentNumber: `MS-${row.sequenceNumber}`,
    createdById: row.createdById,
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
    project: row.project,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : null,
    editable: isSheetEditable(row.status),
    /** true when PROJECT_MANAGER may edit while pending approval (set by enrich) */
    pmApprovalEdit: Boolean(row.pmApprovalEdit),
    /** true when sheet is in manual correction / FIX_REQUIRED (= revision) */
    correctionMode: row.status === "revision",
    rows: mappedRows,
    cells: cells
      .filter((c: any) => !c.boqItem?.deletedAt)
      .filter((c: any) => {
        const rowMeta = rows.find((r: any) => r.id === c.rowId);
        if (!rowMeta) return true;
        if (rowMeta.projectRoom?.deletedAt) return false;
        if (rowMeta.projectRoom?.isHidden) return false;
        return true;
      })
      .map((c: any) => ({
        id: c.id,
        rowId: c.rowId,
        boqItemId: c.boqItemId,
        quantity: num(c.quantity),
        boqItem: c.boqItem
          ? {
              id: c.boqItem.id,
              code: c.boqItem.code,
              description: c.boqItem.description,
              unit: c.boqItem.unit,
              contractQuantity: num(c.boqItem.contractQuantity),
              completedQuantity: num(c.boqItem.completedQuantity),
              unitPrice: num(c.boqItem.unitPrice),
              invoicedQuantity: num(c.boqItem.invoicedQuantity),
              remainingQuantity: num(c.boqItem.remainingQuantity),
            }
          : null,
      })),
    approvals: approvals.map((a: any) => ({
      id: a.id,
      approverId: a.approverId,
      approverName: a.approver?.name,
      status: a.status,
      comment: a.comment,
      sentAt: iso(a.sentAt),
      decidedAt: iso(a.decidedAt),
    })),
    rejectionComment: lastReject?.comment ?? null,
    reviewNotes: reviewNotes.map((n: any) => ({
      id: n.id,
      rowId: n.rowId,
      roomName: n.rowId ? rowNameById.get(n.rowId) || null : null,
      boqItemId: n.boqItemId,
      comment: n.comment,
      version: n.version,
      authorId: n.authorId,
      authorName: n.author?.name,
      createdAt: iso(n.createdAt) ?? new Date(0).toISOString(),
    })),
    events: events.map((e: any) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actorName: e.actor?.name,
      createdAt: iso(e.createdAt) ?? new Date(0).toISOString(),
    })),
    versions: versions.map((v: any) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      note: v.note,
      createdAt: iso(v.createdAt) ?? new Date(0).toISOString(),
    })),
  };
}

type SheetSqlRow = {
  id: string;
  projectId: string;
  title: string;
  sequenceNumber: number;
  status: MeasurementSheetStatus;
  notes: string | null;
  currentVersion: number;
  submittedAt: Date | null;
  approvedAt: Date | null;
  returnedAt: Date | null;
  lastReturnComment: string | null;
  partialInvoiceId: string | null;
  clientSignatureUrl: string | null;
  clientSignedName: string | null;
  clientSignedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    contractor: string | null;
    location: string | null;
    measurementAxisType: MeasurementAxisType;
    measurementAxisLabel: string | null;
  };
  createdBy: { id: string; name: string } | null;
  rows: unknown;
  cells: unknown;
  approvals: unknown;
  reviewNotes: unknown;
  events: unknown;
  versions: unknown;
  authUserId: string | null;
};

export type MeasurementSheetGetResult =
  | { status: "ok"; data: ReturnType<typeof mapSheet> }
  | { status: "not_found" }
  | { status: "forbidden" };

export const AXIS_LABELS: Record<MeasurementAxisType, string> = {
  room: "חדר",
  floor: "קומה",
  building: "בניין",
  area: "אזור",
  custom: "יחידה",
};

export class MeasurementSheetsRepository {
  static async listByProject(projectId: string) {
    const rows = await prisma.measurementSheet.findMany({
      where: { projectId },
      orderBy: { sequenceNumber: "asc" },
      select: {
        id: true,
        title: true,
        sequenceNumber: true,
        status: true,
        currentVersion: true,
        partialInvoiceId: true,
        updatedAt: true,
        _count: { select: { rows: true, cells: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sequenceNumber: r.sequenceNumber,
      status: r.status,
      currentVersion: r.currentVersion,
      partialInvoiceId: r.partialInvoiceId,
      updatedAt: r.updatedAt.toISOString(),
      rowCount: r._count.rows,
      cellCount: r._count.cells,
    }));
  }

  /**
   * Full sheet payload — one SQL round-trip (CTE + json_agg).
   * No Prisma include fan-out. Same mapSheet response shape.
   * Versions omit snapshotJson (not shown on open).
   */
  static async getById(id: string) {
    const result = await this.fetchSheetById(id, null);
    return result.status === "ok" ? result.data : null;
  }

  /**
   * GET hot path: HMAC session user + office auth gate fused into sheet SQL.
   * 1 DB RTT total (same pattern as Project Hub).
   */
  static async getByIdForOffice(
    id: string,
    officeUserId: string
  ): Promise<MeasurementSheetGetResult> {
    const result = await this.fetchSheetById(id, officeUserId);
    if (result.status !== "ok") return result;
    const enriched = await this.enrichPmApprovalEditFlag(
      result.data,
      officeUserId
    );
    return { status: "ok", data: enriched };
  }

  /** Unlock grid for PROJECT_MANAGER while the sheet awaits their approval. */
  private static async enrichPmApprovalEditFlag(
    data: ReturnType<typeof mapSheet>,
    userId: string
  ) {
    if (data.status !== "pending_approval") return data;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== PROJECT_MANAGER_ROLE) return data;

    const pendingIds = (data.approvals ?? [])
      .filter((a) => a.status === "pending")
      .map((a) => a.approverId)
      .filter(Boolean) as string[];

    const ok = await canProjectManagerEditPendingSheet({
      userId,
      role: user.role,
      sheetId: data.id,
      projectId: data.projectId,
      status: data.status,
      pendingApproverIds: pendingIds,
    });
    if (!ok) return data;
    return { ...data, editable: true, pmApprovalEdit: true };
  }

  private static async fetchSheetById(
    id: string,
    officeUserId: string | null
  ): Promise<MeasurementSheetGetResult> {
    const rows = officeUserId
      ? await prisma.$queryRaw<SheetSqlRow[]>`
          WITH auth AS (
            SELECT u.id AS user_id
            FROM "User" u
            LEFT JOIN "Employee" emp ON emp."userId" = u.id
            WHERE u.id = ${officeUserId}
              AND u."passwordHash" IS NOT NULL
              AND u.role IN (
                'PROJECT_MANAGER',
                'OPERATIONS_MANAGER',
                'ADMIN',
                'SYSTEM_MANAGER',
                'admin',
                'מנהל מערכת'
              )
              AND (
                emp.id IS NULL
                OR (emp."isDeleted" = false AND emp.status = 'active')
              )
          ),
          base AS (
            SELECT
              s.id,
              s."projectId",
              s.title,
              s."sequenceNumber",
              s.status,
              s.notes,
              s."currentVersion",
              s."submittedAt",
              s."approvedAt",
              s."returnedAt",
              s."lastReturnComment",
              s."partialInvoiceId",
              s."clientSignatureUrl",
              s."clientSignedName",
              s."clientSignedAt",
              s."createdById",
              s."createdAt",
              s."updatedAt",
              json_build_object(
                'id', p.id,
                'name', p.name,
                'contractor', p.contractor,
                'location', p.location,
                'measurementAxisType', p."measurementAxisType",
                'measurementAxisLabel', p."measurementAxisLabel"
              ) AS project,
              json_build_object(
                'id', cu.id,
                'name', cu.name
              ) AS "createdBy",
              (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
            FROM "MeasurementSheet" s
            INNER JOIN "Project" p ON p.id = s."projectId"
            INNER JOIN "User" cu ON cu.id = s."createdById"
            WHERE s.id = ${id}
          ),
          rows_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', r.id,
                  'name', r.name,
                  'sortOrder', r."sortOrder",
                  'notes', r.notes,
                  'projectRoomId', r."projectRoomId",
                  'projectRoom', CASE
                    WHEN pr.id IS NULL THEN NULL
                    ELSE json_build_object(
                      'id', pr.id,
                      'name', pr.name,
                      'floor', pr.floor,
                      'code', pr.code,
                      'sortOrder', pr."sortOrder",
                      'isHidden', pr."isHidden",
                      'deletedAt', pr."deletedAt"
                    )
                  END
                )
                ORDER BY COALESCE(pr."sortOrder", r."sortOrder") ASC
              ),
              '[]'::json
            ) AS rows
            FROM "MeasurementSheetRow" r
            LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId"
            WHERE r."sheetId" = ${id}
          ),
          cells_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', c.id,
                  'rowId', c."rowId",
                  'boqItemId', c."boqItemId",
                  'quantity', c.quantity,
                  'boqItem', CASE
                    WHEN b.id IS NULL THEN NULL
                    ELSE json_build_object(
                      'id', b.id,
                      'code', b.code,
                      'description', b.description,
                      'unit', b.unit,
                      'contractQuantity', b."contractQuantity",
                      'completedQuantity', b."completedQuantity",
                      'unitPrice', b."unitPrice",
                      'invoicedQuantity', b."invoicedQuantity",
                      'remainingQuantity', b."remainingQuantity",
                      'deletedAt', b."deletedAt"
                    )
                  END
                )
              ),
              '[]'::json
            ) AS cells
            FROM "MeasurementCell" c
            LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
            WHERE c."sheetId" = ${id}
          ),
          approvals_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', a.id,
                  'approverId', a."approverId",
                  'status', a.status,
                  'comment', a.comment,
                  'sentAt', a."sentAt",
                  'decidedAt', a."decidedAt",
                  'approver', json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'role', u.role
                  )
                )
                ORDER BY a."createdAt" DESC
              ),
              '[]'::json
            ) AS approvals
            FROM "MeasurementSheetApproval" a
            INNER JOIN "User" u ON u.id = a."approverId"
            WHERE a."sheetId" = ${id}
          ),
          notes_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', n.id,
                  'rowId', n."rowId",
                  'boqItemId', n."boqItemId",
                  'comment', n.comment,
                  'version', n.version,
                  'authorId', n."authorId",
                  'createdAt', n."createdAt",
                  'author', json_build_object(
                    'id', u.id,
                    'name', u.name
                  )
                )
                ORDER BY n."createdAt" DESC
              ),
              '[]'::json
            ) AS "reviewNotes"
            FROM "MeasurementSheetReviewNote" n
            INNER JOIN "User" u ON u.id = n."authorId"
            WHERE n."sheetId" = ${id}
          ),
          events_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', e.id,
                  'type', e.type,
                  'message', e.message,
                  'createdAt', e."createdAt",
                  'actor', json_build_object(
                    'id', u.id,
                    'name', u.name
                  )
                )
                ORDER BY e."createdAt" DESC
              ),
              '[]'::json
            ) AS events
            FROM (
              SELECT id, type, message, "createdAt", "actorId"
              FROM "MeasurementSheetEvent"
              WHERE "sheetId" = ${id}
              ORDER BY "createdAt" DESC
              LIMIT 40
            ) e
            INNER JOIN "User" u ON u.id = e."actorId"
          ),
          versions_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id,
                  'version', v.version,
                  'status', v.status,
                  'note', v.note,
                  'createdAt', v."createdAt"
                )
                ORDER BY v.version DESC
              ),
              '[]'::json
            ) AS versions
            FROM (
              SELECT id, version, status, note, "createdAt"
              FROM "MeasurementSheetVersion"
              WHERE "sheetId" = ${id}
              ORDER BY version DESC
              LIMIT 20
            ) v
          )
          SELECT
            b.id,
            b."projectId",
            b.title,
            b."sequenceNumber",
            b.status,
            b.notes,
            b."currentVersion",
            b."submittedAt",
            b."approvedAt",
            b."returnedAt",
            b."lastReturnComment",
            b."partialInvoiceId",
            b."clientSignatureUrl",
            b."clientSignedName",
            b."clientSignedAt",
            b."createdById",
            b."createdAt",
            b."updatedAt",
            b.project,
            b."createdBy",
            b."authUserId",
            r.rows,
            c.cells,
            a.approvals,
            n."reviewNotes",
            e.events,
            v.versions
          FROM base b
          CROSS JOIN rows_agg r
          CROSS JOIN cells_agg c
          CROSS JOIN approvals_agg a
          CROSS JOIN notes_agg n
          CROSS JOIN events_agg e
          CROSS JOIN versions_agg v
        `
      : await prisma.$queryRaw<SheetSqlRow[]>`
          WITH base AS (
            SELECT
              s.id,
              s."projectId",
              s.title,
              s."sequenceNumber",
              s.status,
              s.notes,
              s."currentVersion",
              s."submittedAt",
              s."approvedAt",
              s."returnedAt",
              s."lastReturnComment",
              s."partialInvoiceId",
              s."clientSignatureUrl",
              s."clientSignedName",
              s."clientSignedAt",
              s."createdById",
              s."createdAt",
              s."updatedAt",
              json_build_object(
                'id', p.id,
                'name', p.name,
                'contractor', p.contractor,
                'location', p.location,
                'measurementAxisType', p."measurementAxisType",
                'measurementAxisLabel', p."measurementAxisLabel"
              ) AS project,
              json_build_object(
                'id', cu.id,
                'name', cu.name
              ) AS "createdBy",
              NULL::text AS "authUserId"
            FROM "MeasurementSheet" s
            INNER JOIN "Project" p ON p.id = s."projectId"
            INNER JOIN "User" cu ON cu.id = s."createdById"
            WHERE s.id = ${id}
          ),
          rows_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', r.id,
                  'name', r.name,
                  'sortOrder', r."sortOrder",
                  'notes', r.notes,
                  'projectRoomId', r."projectRoomId",
                  'projectRoom', CASE
                    WHEN pr.id IS NULL THEN NULL
                    ELSE json_build_object(
                      'id', pr.id,
                      'name', pr.name,
                      'floor', pr.floor,
                      'code', pr.code,
                      'sortOrder', pr."sortOrder",
                      'isHidden', pr."isHidden",
                      'deletedAt', pr."deletedAt"
                    )
                  END
                )
                ORDER BY COALESCE(pr."sortOrder", r."sortOrder") ASC
              ),
              '[]'::json
            ) AS rows
            FROM "MeasurementSheetRow" r
            LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId"
            WHERE r."sheetId" = ${id}
          ),
          cells_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', c.id,
                  'rowId', c."rowId",
                  'boqItemId', c."boqItemId",
                  'quantity', c.quantity,
                  'boqItem', CASE
                    WHEN b.id IS NULL THEN NULL
                    ELSE json_build_object(
                      'id', b.id,
                      'code', b.code,
                      'description', b.description,
                      'unit', b.unit,
                      'contractQuantity', b."contractQuantity",
                      'completedQuantity', b."completedQuantity",
                      'unitPrice', b."unitPrice",
                      'invoicedQuantity', b."invoicedQuantity",
                      'remainingQuantity', b."remainingQuantity",
                      'deletedAt', b."deletedAt"
                    )
                  END
                )
              ),
              '[]'::json
            ) AS cells
            FROM "MeasurementCell" c
            LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
            WHERE c."sheetId" = ${id}
          ),
          approvals_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', a.id,
                  'approverId', a."approverId",
                  'status', a.status,
                  'comment', a.comment,
                  'sentAt', a."sentAt",
                  'decidedAt', a."decidedAt",
                  'approver', json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'role', u.role
                  )
                )
                ORDER BY a."createdAt" DESC
              ),
              '[]'::json
            ) AS approvals
            FROM "MeasurementSheetApproval" a
            INNER JOIN "User" u ON u.id = a."approverId"
            WHERE a."sheetId" = ${id}
          ),
          notes_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', n.id,
                  'rowId', n."rowId",
                  'boqItemId', n."boqItemId",
                  'comment', n.comment,
                  'version', n.version,
                  'authorId', n."authorId",
                  'createdAt', n."createdAt",
                  'author', json_build_object(
                    'id', u.id,
                    'name', u.name
                  )
                )
                ORDER BY n."createdAt" DESC
              ),
              '[]'::json
            ) AS "reviewNotes"
            FROM "MeasurementSheetReviewNote" n
            INNER JOIN "User" u ON u.id = n."authorId"
            WHERE n."sheetId" = ${id}
          ),
          events_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', e.id,
                  'type', e.type,
                  'message', e.message,
                  'createdAt', e."createdAt",
                  'actor', json_build_object(
                    'id', u.id,
                    'name', u.name
                  )
                )
                ORDER BY e."createdAt" DESC
              ),
              '[]'::json
            ) AS events
            FROM (
              SELECT id, type, message, "createdAt", "actorId"
              FROM "MeasurementSheetEvent"
              WHERE "sheetId" = ${id}
              ORDER BY "createdAt" DESC
              LIMIT 40
            ) e
            INNER JOIN "User" u ON u.id = e."actorId"
          ),
          versions_agg AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id,
                  'version', v.version,
                  'status', v.status,
                  'note', v.note,
                  'createdAt', v."createdAt"
                )
                ORDER BY v.version DESC
              ),
              '[]'::json
            ) AS versions
            FROM (
              SELECT id, version, status, note, "createdAt"
              FROM "MeasurementSheetVersion"
              WHERE "sheetId" = ${id}
              ORDER BY version DESC
              LIMIT 20
            ) v
          )
          SELECT
            b.id,
            b."projectId",
            b.title,
            b."sequenceNumber",
            b.status,
            b.notes,
            b."currentVersion",
            b."submittedAt",
            b."approvedAt",
            b."returnedAt",
            b."lastReturnComment",
            b."partialInvoiceId",
            b."clientSignatureUrl",
            b."clientSignedName",
            b."clientSignedAt",
            b."createdById",
            b."createdAt",
            b."updatedAt",
            b.project,
            b."createdBy",
            b."authUserId",
            r.rows,
            c.cells,
            a.approvals,
            n."reviewNotes",
            e.events,
            v.versions
          FROM base b
          CROSS JOIN rows_agg r
          CROSS JOIN cells_agg c
          CROSS JOIN approvals_agg a
          CROSS JOIN notes_agg n
          CROSS JOIN events_agg e
          CROSS JOIN versions_agg v
        `;

    const row = rows[0];
    if (!row) return { status: "not_found" };
    if (officeUserId && !row.authUserId) return { status: "forbidden" };

    const project =
      typeof row.project === "string"
        ? JSON.parse(row.project)
        : row.project;
    const createdBy =
      typeof row.createdBy === "string"
        ? JSON.parse(row.createdBy)
        : row.createdBy;

    let invoiceNumber: string | null = null;
    if (row.partialInvoiceId) {
      const inv = await prisma.partialInvoice.findUnique({
        where: { id: row.partialInvoiceId },
        select: { invoiceNumber: true },
      });
      invoiceNumber = inv?.invoiceNumber ?? null;
    }

    return {
      status: "ok",
      data: mapSheet({
        ...row,
        project,
        createdBy,
        invoiceNumber,
      }),
    };
  }

  static async create(
    input: {
      projectId: string;
      title: string;
      notes?: string | null;
      rowNames?: string[];
      boqItemIds?: string[];
    },
    userId: string
  ) {
    const last = await prisma.measurementSheet.findFirst({
      where: { projectId: input.projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const title = input.title.trim() || `דף מדידה ${sequenceNumber}`;

    let boqItems = await prisma.boqItem.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        status: { not: "cancelled" },
        ...(input.boqItemIds?.length ? { id: { in: input.boqItemIds } } : {}),
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });

    // Without BOQ columns the grid is empty — seed starter sections so the table is fillable
    if (!boqItems.length && !input.boqItemIds?.length) {
      await this.seedStarterBoq(input.projectId, userId);
      boqItems = await prisma.boqItem.findMany({
        where: {
          projectId: input.projectId,
          deletedAt: null,
          status: { not: "cancelled" },
        },
        orderBy: { code: "asc" },
        select: { id: true },
      });
    }

    const projectRooms = await prisma.projectRoom.findMany({
      where: { projectId: input.projectId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });

    const rowNames =
      input.rowNames?.map((n) => n.trim()).filter(Boolean) ?? [];

    // אם אין חדרים בפרויקט — צור מ־rowNames; אחרת השתמש בחדרים הקיימים
    if (!projectRooms.length && rowNames.length) {
      const { ProjectRoomsRepository } = await import(
        "@/repositories/project-rooms.repository"
      );
      for (const name of rowNames) {
        await ProjectRoomsRepository.create(input.projectId, { name });
      }
    } else if (!projectRooms.length && !rowNames.length) {
      const { ProjectRoomsRepository } = await import(
        "@/repositories/project-rooms.repository"
      );
      for (const name of ["חדר 101", "חדר 102", "חדר 103"]) {
        await ProjectRoomsRepository.create(input.projectId, { name });
      }
    }

    const rooms = await prisma.projectRoom.findMany({
      where: { projectId: input.projectId, deletedAt: null, isHidden: false },
      orderBy: { sortOrder: "asc" },
    });

    const sheet = await prisma.$transaction(async (tx) => {
      const created = await tx.measurementSheet.create({
        data: {
          projectId: input.projectId,
          title,
          sequenceNumber,
          notes: input.notes ?? null,
          status: "draft",
          createdById: userId,
          updatedById: userId,
        },
      });

      if (rooms.length) {
        await tx.measurementSheetRow.createMany({
          data: rooms.map((room) => ({
            sheetId: created.id,
            name: room.name,
            sortOrder: room.sortOrder,
            projectRoomId: room.id,
          })),
        });
      }

      const rows = await tx.measurementSheetRow.findMany({
        where: { sheetId: created.id },
        orderBy: { sortOrder: "asc" },
      });

      if (rows.length && boqItems.length) {
        await tx.measurementCell.createMany({
          data: rows.flatMap((row) =>
            boqItems.map((b) => ({
              sheetId: created.id,
              rowId: row.id,
              boqItemId: b.id,
              quantity: 0,
            }))
          ),
        });
      }

      return created;
    });

    return this.getById(sheet.id);
  }

  static async updateMeta(
    id: string,
    input: { title?: string; notes?: string | null; status?: MeasurementSheetStatus },
    userId: string,
    opts?: { role?: string; expectedVersion?: number }
  ) {
    const existing = await prisma.measurementSheet.findUnique({ where: { id } });
    if (!existing) throw new Error("דף מדידה לא נמצא");

    const pmPending =
      existing.status === "pending_approval" &&
      opts?.role === PROJECT_MANAGER_ROLE;

    if (pmPending) {
      await assertProjectManagerPendingEdit({
        userId,
        role: opts!.role!,
        sheetId: id,
        expectedVersion: opts?.expectedVersion,
      });
    } else {
      assertDocumentMutable(String(existing.status), {
        allowStatuses: MEASUREMENT_EDITABLE_STATUSES,
        entityLabel: "דף המדידה",
      });
    }

    // `input.status` is intentionally IGNORED. Status transitions must go
    // through submitForApproval / decideApproval / applyClientSignature so the
    // workflow gates (approvers, signature, locking) cannot be bypassed via
    // PATCH. Silently strip it here rather than 400 so existing clients that
    // echo the current status back keep working.
    void input.status;

    const title = input.title?.trim();
    const notes = input.notes;
    const titleChanged =
      title !== undefined && title !== existing.title;
    const notesChanged =
      notes !== undefined && notes !== (existing.notes ?? null);

    if (pmPending && (titleChanged || notesChanged)) {
      const versionBefore = existing.currentVersion;
      const versionAfter = versionBefore + 1;
      await prisma.$transaction(async (tx) => {
        const locked = await tx.measurementSheet.updateMany({
          where: {
            id,
            status: "pending_approval",
            currentVersion: versionBefore,
          },
          data: {
            title: titleChanged ? title : undefined,
            notes: notesChanged ? notes : undefined,
            currentVersion: versionAfter,
            updatedById: userId,
          },
        });
        if (!locked.count) {
          throw new PmApprovalEditError(
            "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
            409
          );
        }
        const lastVer = await tx.measurementSheetVersion.findFirst({
          where: { sheetId: id },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.measurementSheetVersion.create({
          data: {
            sheetId: id,
            version: (lastVer?.version ?? 0) + 1,
            status: "pending_approval",
            snapshotJson: "{}",
            note: `V${versionAfter} נערך על ידי מנהל פרויקט (מטא־דאטה)`,
            actorId: userId,
          },
        });
        await tx.measurementSheetEvent.create({
          data: {
            sheetId: id,
            type: "pm_edited",
            message: "נערך על ידי מנהל פרויקט",
            actorId: userId,
            metadata: JSON.stringify({
              documentId: id,
              versionBefore,
              versionAfter,
              role: PROJECT_MANAGER_ROLE,
              changedFields: [
                ...(titleChanged
                  ? [
                      {
                        field: "title",
                        oldValue: existing.title,
                        newValue: title,
                      },
                    ]
                  : []),
                ...(notesChanged
                  ? [
                      {
                        field: "notes",
                        oldValue: existing.notes,
                        newValue: notes,
                      },
                    ]
                  : []),
              ],
              editedBy: userId,
              editedAt: new Date().toISOString(),
            }),
          },
        });
      });
      return this.getById(id);
    }

    await prisma.measurementSheet.update({
      where: { id },
      data: {
        title: title,
        notes: notes,
        updatedById: userId,
      },
    });
    return this.getById(id);
  }

  /** Default BOQ sections so measurement grids are never column-less. */
  static async seedStarterBoq(projectId: string, userId: string) {
    const existing = await prisma.boqItem.count({
      where: { projectId, deletedAt: null, status: { not: "cancelled" } },
    });
    if (existing > 0) return existing;

    const starters = [
      {
        code: "1.01",
        description: "התקנת לוחות חשמל",
        unit: "יח'",
        contractQuantity: 10,
        unitPrice: 2500,
      },
      {
        code: "1.02",
        description: "כבלים מא״ז",
        unit: "מ׳",
        contractQuantity: 500,
        unitPrice: 45,
      },
      {
        code: "1.03",
        description: "תאורה LED",
        unit: "יח'",
        contractQuantity: 80,
        unitPrice: 180,
      },
      {
        code: "1.04",
        description: "שקעים ומפסקים",
        unit: "יח'",
        contractQuantity: 120,
        unitPrice: 95,
      },
      {
        code: "1.05",
        description: "תעלות כבלים",
        unit: "מ׳",
        contractQuantity: 200,
        unitPrice: 35,
      },
    ];

    await prisma.boqItem.createMany({
      data: starters.map((item) => ({
        projectId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        contractQuantity: item.contractQuantity,
        completedQuantity: 0,
        invoicedQuantity: 0,
        remainingQuantity: item.contractQuantity,
        unitPrice: item.unitPrice,
        completedValue: 0,
        remainingValue: item.contractQuantity * item.unitPrice,
        progress: 0,
        status: "active" as const,
        itemKind: "regular" as const,
        createdById: userId,
        updatedById: userId,
      })),
    });
    return starters.length;
  }

  /**
   * Ensure every room×BOQ cell exists on the sheet.
   * Optionally seed starter BOQ when the project has none.
   */
  static async ensureBoqGrid(
    sheetId: string,
    userId: string,
    opts?: { seedIfEmpty?: boolean }
  ) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      select: { id: true, projectId: true, status: true },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }

    let boqItems = await prisma.boqItem.findMany({
      where: {
        projectId: sheet.projectId,
        deletedAt: null,
        status: { not: "cancelled" },
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });

    if (!boqItems.length && opts?.seedIfEmpty !== false) {
      await this.seedStarterBoq(sheet.projectId, userId);
      boqItems = await prisma.boqItem.findMany({
        where: {
          projectId: sheet.projectId,
          deletedAt: null,
          status: { not: "cancelled" },
        },
        orderBy: { code: "asc" },
        select: { id: true },
      });
    }

    if (!boqItems.length) {
      throw new Error("אין סעיפי כתב כמויות בפרויקט");
    }

    const rows = await prisma.measurementSheetRow.findMany({
      where: { sheetId },
      select: { id: true },
    });
    if (!rows.length) {
      throw new Error("אין חדרים בדף המדידה");
    }

    const existing = await prisma.measurementCell.findMany({
      where: { sheetId },
      select: { rowId: true, boqItemId: true },
    });
    const have = new Set(existing.map((c) => `${c.rowId}:${c.boqItemId}`));

    const missing = rows.flatMap((row) =>
      boqItems
        .filter((b) => !have.has(`${row.id}:${b.id}`))
        .map((b) => ({
          sheetId,
          rowId: row.id,
          boqItemId: b.id,
          quantity: 0,
        }))
    );

    if (missing.length) {
      await prisma.measurementCell.createMany({ data: missing });
      await prisma.measurementSheet.update({
        where: { id: sheetId },
        data: {
          updatedById: userId,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
    }

    return this.getById(sheetId);
  }

  static async addRows(
    sheetId: string,
    names: string[],
    userId: string,
    opts?: { role?: string; expectedVersion?: number }
  ) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");

    const pmPending =
      sheet.status === "pending_approval" &&
      opts?.role === PROJECT_MANAGER_ROLE;

    if (pmPending) {
      await assertProjectManagerPendingEdit({
        userId,
        role: opts!.role!,
        sheetId,
        expectedVersion: opts?.expectedVersion,
      });
    } else if (!isSheetEditable(sheet.status)) {
      throw new Error("הדף נעול לעריכה");
    }

    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) throw new Error("יש להזין שם יחידה");

    const { ProjectRoomsRepository } = await import(
      "@/repositories/project-rooms.repository"
    );
    for (const name of clean) {
      await ProjectRoomsRepository.create(sheet.projectId, { name });
    }

    if (pmPending) {
      const versionBefore = sheet.currentVersion;
      const versionAfter = versionBefore + 1;
      const bumped = await prisma.measurementSheet.updateMany({
        where: {
          id: sheetId,
          status: "pending_approval",
          currentVersion: versionBefore,
        },
        data: {
          updatedById: userId,
          currentVersion: versionAfter,
        },
      });
      if (!bumped.count) {
        throw new PmApprovalEditError(
          "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
          409
        );
      }
      await this.addEvent(
        sheetId,
        "pm_edited",
        "נערך על ידי מנהל פרויקט",
        userId,
        {
          documentId: sheetId,
          versionBefore,
          versionAfter,
          role: PROJECT_MANAGER_ROLE,
          changedFields: [{ field: "rows", added: clean }],
          editedBy: userId,
          editedAt: new Date().toISOString(),
        }
      );
    } else {
      await prisma.measurementSheet.update({
        where: { id: sheetId },
        data: {
          updatedById: userId,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
    }

    return this.getById(sheetId);
  }

  /**
   * Single-cell save — one SQL round-trip (same engine as batch).
   */
  static async setCellQuantity(
    sheetId: string,
    input: {
      rowId: string;
      boqItemId: string;
      quantity: number;
      note?: string | null;
    },
    userId: string
  ) {
    const result = await this.saveCellsOneShot(
      sheetId,
      [
        {
          rowId: input.rowId,
          boqItemId: input.boqItemId,
          quantity: input.quantity,
        },
      ],
      userId,
      { fuseAuth: false, note: input.note ?? null, skipUnchanged: false }
    );
    if (result.status === "not_found") throw new Error("דף מדידה לא נמצא");
    if (result.status === "locked") throw new Error("הדף נעול לעריכה");
    if (result.status === "forbidden") throw new Error("אין הרשאה");
    if (result.status === "conflict") throw new Error(result.message);
    if (result.status !== "ok") throw new Error("שגיאה בשמירה");
    const cell = result.cells[0];
    if (!cell) {
      return {
        id: "",
        rowId: input.rowId,
        boqItemId: input.boqItemId,
        quantity: Math.max(0, Number(input.quantity) || 0),
      };
    }
    return cell;
  }

  /**
   * Batch save dirty cells — one SQL round-trip.
   * No full-grid prefetch. Returns { saved } only (API contract unchanged).
   */
  static async setCellsBatch(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    userId: string
  ) {
    const result = await this.saveCellsOneShot(sheetId, cells, userId, {
      fuseAuth: false,
      skipUnchanged: true,
    });
    if (result.status === "not_found") throw new Error("דף מדידה לא נמצא");
    if (result.status === "locked") throw new Error("הדף נעול לעריכה");
    if (result.status === "forbidden") throw new Error("אין הרשאה");
    if (result.status === "conflict") throw new Error(result.message);
    if (result.status !== "ok") throw new Error("שגיאה בשמירה");
    return { saved: result.saved };
  }

  /**
   * HTTP hot path: HMAC + office auth gate fused into cell-save SQL (1 RTT).
   */
  static async setCellsBatchForOffice(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    officeUserId: string
  ): Promise<CellSaveOfficeResult> {
    return this.saveCellsOneShot(sheetId, cells, officeUserId, {
      fuseAuth: true,
      skipUnchanged: true,
    });
  }

  static async setCellQuantityForOffice(
    sheetId: string,
    input: {
      rowId: string;
      boqItemId: string;
      quantity: number;
      note?: string | null;
    },
    officeUserId: string
  ): Promise<
    | {
        status: "ok";
        cell: {
          id: string;
          rowId: string;
          boqItemId: string;
          quantity: number;
        };
      }
    | { status: "not_found" }
    | { status: "forbidden" }
    | { status: "locked" }
  > {
    const result = await this.saveCellsOneShot(
      sheetId,
      [
        {
          rowId: input.rowId,
          boqItemId: input.boqItemId,
          quantity: input.quantity,
        },
      ],
      officeUserId,
      { fuseAuth: true, note: input.note ?? null, skipUnchanged: false }
    );
    if (result.status !== "ok") {
      if (result.status === "conflict") return { status: "locked" };
      return result;
    }
    const cell = result.cells[0] ?? {
      id: "",
      rowId: input.rowId,
      boqItemId: input.boqItemId,
      quantity: Math.max(0, Number(input.quantity) || 0),
    };
    return { status: "ok", cell };
  }

  /**
   * PROJECT_MANAGER edit while the sheet is pending their approval.
   * Preserves pending_approval status, bumps document version, writes timeline.
   * Uses expectedVersion to block silent concurrent overwrites.
   */
  static async saveCellsAsPmApprovalEdit(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    opts: {
      userId: string;
      role: string;
      expectedVersion: number;
    }
  ): Promise<CellSaveOfficeResult> {
    try {
      await assertProjectManagerPendingEdit({
        userId: opts.userId,
        role: opts.role,
        sheetId,
        expectedVersion: opts.expectedVersion,
      });
    } catch (e) {
      if (e instanceof PmApprovalEditError) {
        if (e.status === 404) return { status: "not_found" };
        if (e.status === 409) return { status: "conflict", message: e.message };
        return { status: "forbidden" };
      }
      throw e;
    }

    const versionBefore = opts.expectedVersion;
    const beforeCells = await prisma.measurementCell.findMany({
      where: { sheetId },
      select: { rowId: true, boqItemId: true, quantity: true },
    });
    const beforeMap = new Map(
      beforeCells.map((c) => [`${c.rowId}:${c.boqItemId}`, num(c.quantity)])
    );

    const changed: {
      rowId: string;
      boqItemId: string;
      oldQuantity: number;
      newQuantity: number;
    }[] = [];

    for (const c of cells) {
      const rowId = String(c.rowId);
      const boqItemId = String(c.boqItemId);
      const newQuantity = Math.max(0, Number(c.quantity) || 0);
      const key = `${rowId}:${boqItemId}`;
      const oldQuantity = beforeMap.has(key) ? beforeMap.get(key)! : 0;
      if (oldQuantity === newQuantity && beforeMap.has(key)) continue;
      changed.push({ rowId, boqItemId, oldQuantity, newQuantity });
    }

    if (!changed.length) {
      return {
        status: "ok",
        saved: 0,
        cells: [],
        currentVersion: versionBefore,
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const locked = await tx.measurementSheet.findFirst({
          where: {
            id: sheetId,
            status: "pending_approval",
            currentVersion: versionBefore,
          },
          select: { id: true, currentVersion: true },
        });
        if (!locked) {
          throw new PmApprovalEditError(
            "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
            409
          );
        }

        const savedCells: {
          id: string;
          rowId: string;
          boqItemId: string;
          quantity: number;
        }[] = [];

        for (const c of changed) {
          const upserted = await tx.measurementCell.upsert({
            where: {
              rowId_boqItemId: { rowId: c.rowId, boqItemId: c.boqItemId },
            },
            create: {
              sheetId,
              rowId: c.rowId,
              boqItemId: c.boqItemId,
              quantity: c.newQuantity,
            },
            update: { quantity: c.newQuantity },
            select: {
              id: true,
              rowId: true,
              boqItemId: true,
              quantity: true,
            },
          });
          await tx.measurementEntry.create({
            data: {
              sheetId,
              cellId: upserted.id,
              boqItemId: c.boqItemId,
              rowId: c.rowId,
              oldQuantity: c.oldQuantity,
              newQuantity: c.newQuantity,
              note: "עריכת מנהל פרויקט באישור",
              actorId: opts.userId,
            },
          });
          savedCells.push({
            id: upserted.id,
            rowId: upserted.rowId,
            boqItemId: upserted.boqItemId,
            quantity: num(upserted.quantity),
          });
        }

        const versionAfter = versionBefore + 1;
        const lastVer = await tx.measurementSheetVersion.findFirst({
          where: { sheetId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const versionRow = (lastVer?.version ?? 0) + 1;

        await tx.measurementSheet.update({
          where: { id: sheetId },
          data: {
            currentVersion: versionAfter,
            updatedById: opts.userId,
            // keep pending_approval
          },
        });

        const afterSheet = await tx.measurementSheet.findUnique({
          where: { id: sheetId },
          include: sheetInclude,
        });

        await tx.measurementSheetVersion.create({
          data: {
            sheetId,
            version: versionRow,
            status: "pending_approval",
            snapshotJson: JSON.stringify(
              afterSheet ? mapSheet({ ...afterSheet, pmApprovalEdit: true }) : {}
            ),
            note: `V${versionAfter} נערך על ידי מנהל פרויקט (מ־V${versionBefore})`,
            actorId: opts.userId,
          },
        });

        await tx.measurementSheetEvent.create({
          data: {
            sheetId,
            type: "pm_edited",
            message: "נערך על ידי מנהל פרויקט",
            actorId: opts.userId,
            metadata: JSON.stringify({
              documentId: sheetId,
              versionBefore,
              versionAfter,
              role: PROJECT_MANAGER_ROLE,
              changedFields: changed.map((c) => ({
                rowId: c.rowId,
                boqItemId: c.boqItemId,
                oldValue: c.oldQuantity,
                newValue: c.newQuantity,
              })),
              editedBy: opts.userId,
              editedAt: new Date().toISOString(),
            }),
          },
        });

        return {
          status: "ok" as const,
          saved: savedCells.length,
          cells: savedCells,
          currentVersion: versionAfter,
        };
      });
      return result;
    } catch (e) {
      if (e instanceof PmApprovalEditError) {
        if (e.status === 409) return { status: "conflict", message: e.message };
        if (e.status === 404) return { status: "not_found" };
        return { status: "forbidden" };
      }
      throw e;
    }
  }

  /**
   * Auth (optional) + editable gate + UPSERT cells + audit entries + sheet touch
   * in a single PostgreSQL statement — 1 remote RTT.
   */
  private static async saveCellsOneShot(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    userId: string,
    opts: { fuseAuth: boolean; note?: string | null; skipUnchanged: boolean }
  ): Promise<CellSaveOfficeResult> {
    const note = opts.note ?? null;
    const skipUnchanged = opts.skipUnchanged;
    const payload = cells.map((c) => ({
      id: newEntityId(),
      entryId: newEntityId(),
      rowId: String(c.rowId),
      boqItemId: String(c.boqItemId),
      quantity: Math.max(0, Number(c.quantity) || 0),
    }));
    const cellsJson = JSON.stringify(payload);

    type SaveRow = {
      authUserId: string | null;
      sheetId: string | null;
      sheetStatus: string | null;
      saved: number;
      cells: unknown;
    };

    const rows = opts.fuseAuth
      ? await prisma.$queryRaw<SaveRow[]>`
          WITH auth AS (
            SELECT u.id AS user_id
            FROM "User" u
            LEFT JOIN "Employee" emp ON emp."userId" = u.id
            WHERE u.id = ${userId}
              AND u."passwordHash" IS NOT NULL
              AND u.role IN (
                'PROJECT_MANAGER',
                'OPERATIONS_MANAGER',
                'ADMIN',
                'SYSTEM_MANAGER',
                'admin',
                'מנהל מערכת'
              )
              AND (
                emp.id IS NULL
                OR (emp."isDeleted" = false AND emp.status = 'active')
              )
          ),
          gate AS (
            SELECT
              (SELECT user_id FROM auth LIMIT 1) AS "authUserId",
              s.id AS "sheetId",
              s.status::text AS "sheetStatus"
            FROM (SELECT 1) AS _
            LEFT JOIN "MeasurementSheet" s ON s.id = ${sheetId}
          ),
          incoming AS (
            SELECT *
            FROM jsonb_to_recordset(CAST(${cellsJson} AS jsonb))
              AS x(
                id text,
                "entryId" text,
                "rowId" text,
                "boqItemId" text,
                quantity numeric
              )
          ),
          prepared AS (
            SELECT
              i.id AS proposed_id,
              i."entryId",
              i."rowId",
              i."boqItemId",
              i.quantity AS new_qty,
              c.id AS existing_id,
              COALESCE(c.quantity, 0) AS old_qty
            FROM incoming i
            INNER JOIN gate g
              ON g."authUserId" IS NOT NULL
              AND g."sheetId" IS NOT NULL
              AND g."sheetStatus" IN ('draft', 'in_progress', 'revision')
            LEFT JOIN "MeasurementCell" c
              ON c."rowId" = i."rowId"
              AND c."boqItemId" = i."boqItemId"
            WHERE (${skipUnchanged} = false)
               OR c.id IS NULL
               OR c.quantity IS DISTINCT FROM i.quantity
          ),
          upserted AS (
            INSERT INTO "MeasurementCell" (
              id, "sheetId", "rowId", "boqItemId", quantity, "createdAt", "updatedAt"
            )
            SELECT
              COALESCE(p.existing_id, p.proposed_id),
              ${sheetId},
              p."rowId",
              p."boqItemId",
              p.new_qty,
              NOW(),
              NOW()
            FROM prepared p
            ON CONFLICT ("rowId", "boqItemId") DO UPDATE
              SET quantity = EXCLUDED.quantity,
                  "updatedAt" = NOW()
            RETURNING id, "rowId", "boqItemId", quantity
          ),
          entries AS (
            INSERT INTO "MeasurementEntry" (
              id, "sheetId", "cellId", "boqItemId", "rowId",
              "oldQuantity", "newQuantity", note, "actorId", "createdAt"
            )
            SELECT
              p."entryId",
              ${sheetId},
              u.id,
              u."boqItemId",
              u."rowId",
              p.old_qty,
              u.quantity,
              ${note},
              g."authUserId",
              NOW()
            FROM upserted u
            INNER JOIN prepared p
              ON p."rowId" = u."rowId" AND p."boqItemId" = u."boqItemId"
            CROSS JOIN gate g
            RETURNING id
          ),
          sheet_touch AS (
            UPDATE "MeasurementSheet" s
            SET
              "updatedById" = g."authUserId",
              "updatedAt" = NOW(),
              status = CASE
                WHEN s.status = 'revision'::"MeasurementSheetStatus"
                  THEN 'revision'::"MeasurementSheetStatus"
                ELSE 'in_progress'::"MeasurementSheetStatus"
              END
            FROM gate g
            WHERE s.id = ${sheetId}
              AND g."authUserId" IS NOT NULL
              AND g."sheetId" IS NOT NULL
              AND g."sheetStatus" IN ('draft', 'in_progress', 'revision')
              AND EXISTS (SELECT 1 FROM upserted)
            RETURNING s.id
          )
          SELECT
            g."authUserId",
            g."sheetId",
            g."sheetStatus",
            (SELECT COUNT(*)::int FROM upserted) AS saved,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'rowId', u."rowId",
                    'boqItemId', u."boqItemId",
                    'quantity', u.quantity
                  )
                ),
                '[]'::json
              )
              FROM upserted u
            ) AS cells
          FROM gate g
        `
      : await prisma.$queryRaw<SaveRow[]>`
          WITH gate AS (
            SELECT
              ${userId}::text AS "authUserId",
              s.id AS "sheetId",
              s.status::text AS "sheetStatus"
            FROM (SELECT 1) AS _
            LEFT JOIN "MeasurementSheet" s ON s.id = ${sheetId}
          ),
          incoming AS (
            SELECT *
            FROM jsonb_to_recordset(CAST(${cellsJson} AS jsonb))
              AS x(
                id text,
                "entryId" text,
                "rowId" text,
                "boqItemId" text,
                quantity numeric
              )
          ),
          prepared AS (
            SELECT
              i.id AS proposed_id,
              i."entryId",
              i."rowId",
              i."boqItemId",
              i.quantity AS new_qty,
              c.id AS existing_id,
              COALESCE(c.quantity, 0) AS old_qty
            FROM incoming i
            INNER JOIN gate g
              ON g."sheetId" IS NOT NULL
              AND g."sheetStatus" IN ('draft', 'in_progress', 'revision')
            LEFT JOIN "MeasurementCell" c
              ON c."rowId" = i."rowId"
              AND c."boqItemId" = i."boqItemId"
            WHERE (${skipUnchanged} = false)
               OR c.id IS NULL
               OR c.quantity IS DISTINCT FROM i.quantity
          ),
          upserted AS (
            INSERT INTO "MeasurementCell" (
              id, "sheetId", "rowId", "boqItemId", quantity, "createdAt", "updatedAt"
            )
            SELECT
              COALESCE(p.existing_id, p.proposed_id),
              ${sheetId},
              p."rowId",
              p."boqItemId",
              p.new_qty,
              NOW(),
              NOW()
            FROM prepared p
            ON CONFLICT ("rowId", "boqItemId") DO UPDATE
              SET quantity = EXCLUDED.quantity,
                  "updatedAt" = NOW()
            RETURNING id, "rowId", "boqItemId", quantity
          ),
          entries AS (
            INSERT INTO "MeasurementEntry" (
              id, "sheetId", "cellId", "boqItemId", "rowId",
              "oldQuantity", "newQuantity", note, "actorId", "createdAt"
            )
            SELECT
              p."entryId",
              ${sheetId},
              u.id,
              u."boqItemId",
              u."rowId",
              p.old_qty,
              u.quantity,
              ${note},
              g."authUserId",
              NOW()
            FROM upserted u
            INNER JOIN prepared p
              ON p."rowId" = u."rowId" AND p."boqItemId" = u."boqItemId"
            CROSS JOIN gate g
            RETURNING id
          ),
          sheet_touch AS (
            UPDATE "MeasurementSheet" s
            SET
              "updatedById" = g."authUserId",
              "updatedAt" = NOW(),
              status = CASE
                WHEN s.status = 'revision'::"MeasurementSheetStatus"
                  THEN 'revision'::"MeasurementSheetStatus"
                ELSE 'in_progress'::"MeasurementSheetStatus"
              END
            FROM gate g
            WHERE s.id = ${sheetId}
              AND g."sheetId" IS NOT NULL
              AND g."sheetStatus" IN ('draft', 'in_progress', 'revision')
              AND EXISTS (SELECT 1 FROM upserted)
            RETURNING s.id
          )
          SELECT
            g."authUserId",
            g."sheetId",
            g."sheetStatus",
            (SELECT COUNT(*)::int FROM upserted) AS saved,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'rowId', u."rowId",
                    'boqItemId', u."boqItemId",
                    'quantity', u.quantity
                  )
                ),
                '[]'::json
              )
              FROM upserted u
            ) AS cells
          FROM gate g
        `;

    const row = rows[0];
    if (!row) return { status: "not_found" };
    if (opts.fuseAuth && !row.authUserId) return { status: "forbidden" };
    if (!row.sheetId) return { status: "not_found" };
    if (
      row.sheetStatus !== "draft" &&
      row.sheetStatus !== "in_progress" &&
      row.sheetStatus !== "revision"
    ) {
      return { status: "locked" };
    }

    let cellsOut: {
      id: string;
      rowId: string;
      boqItemId: string;
      quantity: number;
    }[] = [];
    const raw = row.cells;
    if (Array.isArray(raw)) {
      cellsOut = raw.map((c: any) => ({
        id: String(c.id),
        rowId: String(c.rowId),
        boqItemId: String(c.boqItemId),
        quantity: num(c.quantity),
      }));
    } else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cellsOut = parsed.map((c: any) => ({
            id: String(c.id),
            rowId: String(c.rowId),
            boqItemId: String(c.boqItemId),
            quantity: num(c.quantity),
          }));
        }
      } catch {
        cellsOut = [];
      }
    }

    return {
      status: "ok",
      saved: Number(row.saved) || 0,
      cells: cellsOut,
    };
  }

  /**
   * "Complete" is an alias for submitForApproval — approvers are REQUIRED.
   * The historical `skipApprovers` fast-path used to jump straight to
   * `approved` without any review; it has been removed so a sheet can never
   * become approved without an actual approval decision.
   */
  static async completeSheet(
    sheetId: string,
    approverIds: string[],
    userId: string,
    printBaseUrl?: string
  ) {
    if (!approverIds?.length) {
      throw new Error("יש לבחור מאשרים");
    }
    return this.submitForApproval(sheetId, approverIds, userId, printBaseUrl);
  }

  static async ensureDocument(
    sheetId: string,
    userId: string,
    status: MeasurementSheetStatus,
    printBaseUrl?: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new Error("דף מדידה לא נמצא");

    const printPath = `/print/measurement-sheets/${sheetId}`;
    const url = printBaseUrl
      ? `${printBaseUrl.replace(/\/$/, "")}${printPath}`
      : printPath;
    const folderPath = documentFolderForStatus(status);
    const docName = `${sheet.title || `דף מדידה ${sheet.sequenceNumber}`}.pdf`;
    const path = `print/measurement-sheets/${sheetId}`;

    const existing = await prisma.document.findFirst({
      where: { projectId: sheet.projectId, path },
    });

    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          folderPath,
          name: docName,
          url,
          sourceType: "measurement_sheet",
          sourceId: sheetId,
          updatedById: userId,
        },
      });
      return { id: existing.id, name: docName, folderPath, url };
    }

    const doc = await prisma.document.create({
      data: {
        projectId: sheet.projectId,
        name: docName,
        type: "pdf",
        extension: "pdf",
        size: 0,
        bucket: "documents",
        path,
        url,
        folderPath,
        sourceType: "measurement_sheet",
        sourceId: sheetId,
        uploadedById: userId,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        versions: {
          create: {
            version: 1,
            size: 0,
            bucket: "documents",
            path,
            url,
            uploadedById: userId,
          },
        },
      },
    });
    return { id: doc.id, name: docName, folderPath, url };
  }

  private static async addEvent(
    sheetId: string,
    type: string,
    message: string,
    actorId: string,
    metadata?: unknown
  ) {
    await prisma.measurementSheetEvent.create({
      data: {
        sheetId,
        type,
        message,
        actorId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  private static async notify(
    userIds: string[],
    title: string,
    message: string,
    link: string,
    projectId: string
  ) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    await prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        projectId,
        type: "document" as const,
        title,
        message,
        link,
      })),
    });
  }

  /**
   * שליחה לאישור מנהל תפעול — יוצר גרסה חדשה ומעדכן תיקיית מסמכים.
   *
   * NOTE: approvers are ALWAYS required — the legacy `skipApprovers` short
   * circuit that flipped the sheet straight to `approved` has been removed to
   * guarantee that no sheet becomes approved without an explicit decision.
   */
  static async submitForApproval(
    sheetId: string,
    approverIds: string[],
    userId: string,
    printBaseUrl?: string
  ) {
    const sheet = await this.getById(sheetId);
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (!isSheetEditable(sheet.status) && sheet.status !== "pending_approval") {
      if (
        sheet.status === "approved" ||
        sheet.status === "locked" ||
        sheet.status === "invoiced"
      ) {
        throw new Error("הדוח כבר אושר או חויב");
      }
    }
    if (!approverIds.length) {
      throw new Error("יש לבחור לפחות מאשר אחד");
    }

    const lastVer = await prisma.measurementSheetVersion.findFirst({
      where: { sheetId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const versionRow = (lastVer?.version ?? 0) + 1;
    const docVersion =
      sheet.status === "revision" || sheet.submittedAt
        ? (sheet.currentVersion ?? 1) + 1
        : Math.max(1, sheet.currentVersion ?? 1);
    const snapshot = JSON.stringify(sheet);

    await prisma.$transaction(async (tx) => {
      await tx.measurementSheetApproval.updateMany({
        where: { sheetId, status: "pending" },
        data: { status: "cancelled" },
      });

      await tx.measurementSheetApproval.createMany({
        data: approverIds.map((approverId) => ({
          sheetId,
          approverId,
          status: "pending" as const,
        })),
      });

      await tx.measurementSheetVersion.create({
        data: {
          sheetId,
          version: versionRow,
          status: "pending_approval",
          snapshotJson: snapshot,
          note:
            sheet.status === "revision"
              ? `V${docVersion} תוקן ונשלח מחדש לאישור`
              : `V${docVersion} נשלח לאישור`,
          actorId: userId,
        },
      });

      await tx.measurementSheet.update({
        where: { id: sheetId },
        data: {
          status: "pending_approval",
          currentVersion: docVersion,
          submittedAt: new Date(),
          approvedAt: null,
          returnedAt: null,
          lastReturnComment: null,
          updatedById: userId,
        },
      });
    });

    const status: MeasurementSheetStatus = "pending_approval";
    const doc = await this.ensureDocument(sheetId, userId, status, printBaseUrl);

    await this.addEvent(
      sheetId,
      "submitted",
      `V${docVersion} נשלח לאישור`,
      userId,
      { version: docVersion, approverIds }
    );

    // Field managers land on /field/approvals; office on /approvals.
    const fieldApproverIds = await prisma.user.findMany({
      where: { id: { in: approverIds }, role: "FIELD_MANAGER" },
      select: { id: true },
    });
    const fieldIds = new Set(fieldApproverIds.map((u) => u.id));
    const officeIds = approverIds.filter((id) => !fieldIds.has(id));
    if (fieldIds.size) {
      await this.notify(
        [...fieldIds],
        "דוח ביצוע ממתין לאישור",
        `${sheet.title} (V${docVersion}) ממתין לאישורך`,
        `/field/approvals`,
        sheet.projectId
      );
    }
    if (officeIds.length) {
      await this.notify(
        officeIds,
        "דוח ביצוע ממתין לאישור",
        `${sheet.title} (V${docVersion}) ממתין לאישורך`,
        `/approvals`,
        sheet.projectId
      );
    }

    await prisma.activity.create({
      data: {
        projectId: sheet.projectId,
        type: "status_changed",
        title: "דוח ביצוע נשלח לאישור",
        description: `${sheet.title} · V${docVersion}`,
        userId,
        metadata: JSON.stringify({ sheetId, version: docVersion, status }),
      },
    });

    return { sheet: await this.getById(sheetId), document: doc };
  }

  static async decideApproval(
    sheetId: string,
    approverId: string,
    decision: "approved" | "rejected",
    comment?: string | null,
    reviewNotes?: { rowId?: string | null; boqItemId?: string | null; comment: string }[],
    printBaseUrl?: string
  ) {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      include: {
        approvals: {
          include: { approver: { select: { id: true, name: true } } },
        },
      },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");

    const priorApproved = sheet.approvals.find((a) => a.status === "approved");
    if (sheet.status === "approved" || sheet.status === "locked" || sheet.status === "invoiced") {
      const when = sheet.approvedAt
        ? new Date(sheet.approvedAt).toLocaleString("he-IL")
        : "";
      const who = priorApproved?.approver?.name || "מאשר אחר";
      throw new Error(
        `המסמך כבר אושר${who ? ` על ידי ${who}` : ""}${when ? ` ב־${when}` : ""} — לא ניתן לאשר שוב`
      );
    }
    if (sheet.status === "revision") {
      const rejector = sheet.approvals.find((a) => a.status === "rejected");
      const who = rejector?.approver?.name;
      throw new Error(
        `המסמך הוחזר לתיקון${who ? ` על ידי ${who}` : ""}${
          sheet.lastReturnComment ? `: ${sheet.lastReturnComment}` : ""
        }. יש לתקן ולשלוח מחדש לפני אישור.`
      );
    }
    if (sheet.status !== "pending_approval") {
      throw new Error("המסמך אינו ממתין לאישור כעת");
    }

    const mine = sheet.approvals.find(
      (a) => a.approverId === approverId && a.status === "pending"
    );
    if (!mine) {
      if (priorApproved) {
        throw new Error(
          `המסמך כבר אושר על ידי ${priorApproved.approver?.name || "מאשר אחר"} — אין צורך באישור נוסף`
        );
      }
      throw new Error("אין בקשת אישור ממתינה עבורך");
    }

    if (decision === "rejected") {
      if (!comment?.trim() && !(reviewNotes?.length)) {
        throw new Error("חובה לרשום הערות מנהל להחזרה לתיקון");
      }
      const summary = comment?.trim() || "הוחזר לתיקון עם הערות על שורות";

      await prisma.$transaction(async (tx) => {
        await tx.measurementSheetApproval.update({
          where: { id: mine.id },
          data: { status: "rejected", comment: summary, decidedAt: new Date() },
        });
        await tx.measurementSheetApproval.updateMany({
          where: { sheetId, status: "pending" },
          data: { status: "cancelled" },
        });
        if (reviewNotes?.length) {
          await tx.measurementSheetReviewNote.createMany({
            data: reviewNotes
              .filter((n) => n.comment.trim())
              .map((n) => ({
                sheetId,
                rowId: n.rowId || null,
                boqItemId: n.boqItemId || null,
                comment: n.comment.trim(),
                version: sheet.currentVersion,
                authorId: approverId,
              })),
          });
        }
        const lastVer = await tx.measurementSheetVersion.findFirst({
          where: { sheetId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.measurementSheetVersion.create({
          data: {
            sheetId,
            version: (lastVer?.version ?? 0) + 1,
            status: "revision",
            snapshotJson: "{}",
            note: `V${sheet.currentVersion} הוחזר לתיקון: ${summary}`,
            actorId: approverId,
          },
        });
        await tx.measurementSheet.update({
          where: { id: sheetId },
          data: {
            status: "revision",
            returnedAt: new Date(),
            lastReturnComment: summary,
            updatedById: approverId,
          },
        });
      });

      await this.ensureDocument(sheetId, approverId, "revision", printBaseUrl);
      await this.addEvent(sheetId, "returned", `הוחזר לתיקון: ${summary}`, approverId, {
        reviewNotes,
      });
      const fixLink = `/system/accounts?projectId=${sheet.projectId}&module=performance&sheetId=${sheetId}`;
      await this.notify(
        [sheet.createdById],
        "דוח ביצוע דורש תיקון",
        `${sheet.title}: ${summary}`,
        fixLink,
        sheet.projectId
      );

      return {
        ...(await this.getById(sheetId)),
        approvalComplete: true,
        decision: "rejected" as const,
      };
    }

    // any_one — אישור אחד מספיק; שאר הבקשות נסגרות מיד
    const approvedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.measurementSheetApproval.update({
        where: { id: mine.id },
        data: {
          status: "approved",
          comment: comment ?? null,
          decidedAt: approvedAt,
        },
      });
      await tx.measurementSheetApproval.updateMany({
        where: { sheetId, status: "pending" },
        data: { status: "cancelled" },
      });
      const lastVer = await tx.measurementSheetVersion.findFirst({
        where: { sheetId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.measurementSheetVersion.create({
        data: {
          sheetId,
          version: (lastVer?.version ?? 0) + 1,
          status: "approved",
          snapshotJson: "{}",
          note: `V${sheet.currentVersion} אושר (אישור יחיד)`,
          actorId: approverId,
        },
      });
      await tx.measurementSheet.update({
        where: { id: sheetId },
        data: {
          status: "approved",
          approvedAt,
          updatedById: approverId,
        },
      });
    });

    await this.ensureDocument(sheetId, approverId, "approved", printBaseUrl);
    await this.addEvent(
      sheetId,
      "approved",
      `V${sheet.currentVersion} אושר`,
      approverId,
      { mode: "any_one" }
    );
    await this.notify(
      [sheet.createdById],
      "דוח ביצוע אושר",
      `${sheet.title} אושר — ניתן להפיק חשבון`,
      `/system/accounts?projectId=${sheet.projectId}&module=performance&sheetId=${sheetId}`,
      sheet.projectId
    );

    return {
      ...(await this.getById(sheetId)),
      approvalComplete: true,
      decision: "approved" as const,
      approvedAt: approvedAt.toISOString(),
    };
  }

  static async listPendingApprovals(approverId: string) {
    const rows = await prisma.measurementSheetApproval.findMany({
      where: { approverId, status: "pending" },
      include: {
        sheet: {
          select: {
            id: true,
            title: true,
            sequenceNumber: true,
            status: true,
            currentVersion: true,
            projectId: true,
            project: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    return rows.map((r) => ({
      kind: "measurement_sheet" as const,
      approvalId: r.id,
      documentId: r.sheetId,
      documentNumber: `MS-${r.sheet.sequenceNumber}`,
      title: r.sheet.title,
      projectName: r.sheet.project?.name,
      projectId: r.sheet.projectId,
      createdByName: r.sheet.createdBy?.name,
      version: r.sheet.currentVersion,
      status: r.sheet.status,
      sentAt: r.sentAt.toISOString(),
      // Consumers rewrite by portal; field uses /field/approvals/review/...
      link: `/approvals/review/measurement_sheet/${r.sheetId}`,
    }));
  }

  /** Create WhatsApp/client signature link after office approval */
  static async createClientSignLink(
    sheetId: string,
    actorId: string,
    baseUrl: string
  ): Promise<{ url: string; documentNumber: string }> {
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        status: true,
        sequenceNumber: true,
        title: true,
        projectId: true,
        createdById: true,
      },
    });
    if (!sheet) throw new Error("דף מדידה לא נמצא");
    if (
      sheet.status !== "approved" &&
      sheet.status !== "locked" &&
      sheet.status !== "invoiced"
    ) {
      throw new Error("ניתן לשלוח ללקוח רק לאחר אישור הדוח");
    }

    await prisma.measurementSheetSignToken.updateMany({
      where: { sheetId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { raw, hash, publicId } = generateSignToken();
    await prisma.measurementSheetSignToken.create({
      data: {
        sheetId,
        tokenHash: hash,
        publicId,
        createdById: actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const documentNumber = `MS-${sheet.sequenceNumber}`;
    const url = buildSignUrl({
      baseUrl,
      kind: "measurement-sheet",
      documentNumber: sheetId,
      publicId,
      rawToken: raw,
    });

    await this.addEvent(
      sheetId,
      "sent_to_client",
      `נשלח ללקוח לחתימה · ${documentNumber}`,
      actorId,
      { url: url.slice(0, 200) }
    );

    await this.notify(
      [sheet.createdById, actorId],
      "דוח ביצוע נשלח ללקוח",
      `${sheet.title} (${documentNumber}) נשלח לחתימת לקוח`,
      `/operations/approvals/sheets/${sheetId}`,
      sheet.projectId
    );

    return { url, documentNumber };
  }

  static async getPublicForSign(sheetId: string, tokenParam: string) {
    const { buildMeasurementPortal } = await import(
      "@/lib/share/client-portal-payload"
    );
    const parsed = parseSignQuery(tokenParam);
    if (!parsed) throw new Error("קישור לא תקין");

    const token = await prisma.measurementSheetSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        sheetId,
      },
      include: {
        sheet: { include: sheetInclude },
      },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const mapped = mapSheet(token.sheet);
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
    const docNumber = `MS-${String(mapped.sequenceNumber || 0).padStart(6, "0")}`;
    const verificationId = buildVerificationId(docNumber, token.publicId);
    const portal = await buildMeasurementPortal(mapped, {
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      sentBy,
      alreadySigned: Boolean(token.usedAt || token.sheet.clientSignedAt),
    });

    return {
      ...mapped,
      kind: "measurement_sheet" as const,
      portal,
      alreadySigned: portal.alreadySigned,
      verificationId,
    };
  }

  static async applyClientSignature(opts: {
    sheetId: string;
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

    const token = await prisma.measurementSheetSignToken.findFirst({
      where: {
        publicId: parsed.publicId,
        revokedAt: null,
        sheetId: opts.sheetId,
      },
    });
    if (!token) throw new Error("קישור לא נמצא");
    if (token.usedAt) throw new Error("הקישור כבר נוצל");
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error("הקישור פג תוקף");
    }
    if (token.tokenHash !== hashSignToken(parsed.raw)) {
      throw new Error("קישור לא תקין");
    }

    const sheetRow = await prisma.measurementSheet.findUnique({
      where: { id: opts.sheetId },
      select: {
        id: true,
        projectId: true,
        title: true,
        sequenceNumber: true,
        createdById: true,
        updatedById: true,
      },
    });
    if (!sheetRow) throw new Error("דף מדידה לא נמצא");

    const signedAt = new Date();
    const docNumber = `MS-${String(sheetRow.sequenceNumber).padStart(6, "0")}`;
    const verificationId = buildVerificationId(docNumber, token.publicId);
    const signedViewPath = `/sign/measurement-sheet/${opts.sheetId}/signed?t=${encodeURIComponent(opts.tokenParam)}`;

    await prisma.$transaction(async (tx) => {
      await tx.measurementSheetSignToken.update({
        where: { id: token.id },
        data: { usedAt: signedAt },
      });
      await tx.measurementSheet.update({
        where: { id: opts.sheetId },
        data: {
          clientSignatureUrl: signatureDataUrl,
          clientSignedName: opts.signerName,
          clientSignedAt: signedAt,
          clientSignedIp: opts.ip ?? null,
          clientSignedDevice: opts.device?.slice(0, 255) ?? null,
          status: "locked",
        },
      });
    });

    await this.addEvent(
      opts.sheetId,
      "client_signed",
      `נחתם ע״י לקוח: ${opts.signerName}`,
      token.createdById || sheetRow.createdById
    );

    await this.ensureDocument(
      opts.sheetId,
      sheetRow.createdById,
      "locked"
    );

    if (opts.saveToDocuments !== false) {
      await archiveClientSignedDocument({
        kind: "measurement_sheet",
        projectId: sheetRow.projectId,
        entityId: sheetRow.id,
        documentNumber: docNumber,
        title: sheetRow.title,
        userId: sheetRow.createdById,
        signedViewPath,
        signerName: opts.signerName,
        signedAt,
        ip: opts.ip,
        device: opts.device,
        linkPublicId: token.publicId,
        verificationId,
      });
    }

    const approverIds = await prisma.measurementSheetApproval
      .findMany({
        where: { sheetId: opts.sheetId },
        select: { approverId: true },
      })
      .then((rows) => rows.map((r) => r.approverId));

    const notifyIds = [
      ...new Set(
        [sheetRow.createdById, sheetRow.updatedById, ...approverIds].filter(
          Boolean
        )
      ),
    ];
    if (notifyIds.length) {
      await prisma.notification.createMany({
        data: notifyIds.map((userId) => ({
          userId,
          projectId: sheetRow.projectId,
          type: "document" as const,
          title: "הלקוח חתם על דף מדידה",
          message: `${sheetRow.title || docNumber} נחתם ע״י ${opts.signerName}`,
          link: signedViewPath,
        })),
      });
    }

    const mapped = await this.getById(opts.sheetId);
    return {
      ...mapped,
      verificationId,
      signedViewUrl: signedViewPath,
      signedPdfUrl: signedViewPath,
      alreadySigned: true,
    };
  }

  /**
   * מסמכים בסטטוס revision שהמשתמש רשאי לתקן (לא רק לראות).
   * Field → יוצר בלבד. PM → פרויקטים בבעלות. System/Ops → הכול.
   */
  static async listNeedingFix(userId: string, role: string) {
    const { isSystemAdminRole } = await import(
      "@/lib/auth/document-permissions"
    );
    const { OPERATIONS_MANAGER_ROLE, PROJECT_MANAGER_ROLE } = await import(
      "@/lib/auth/roles"
    );
    const { isFieldManagerRole } = await import("@/lib/auth/roles");

    const where: {
      status: "revision";
      createdById?: string;
      project?: { ownerId: string };
    } = { status: "revision" };

    if (isFieldManagerRole(role)) {
      where.createdById = userId;
    } else if (role === PROJECT_MANAGER_ROLE && !isSystemAdminRole(role)) {
      where.project = { ownerId: userId };
    } else if (
      !isSystemAdminRole(role) &&
      role !== OPERATIONS_MANAGER_ROLE
    ) {
      where.createdById = userId;
    }

    const rows = await prisma.measurementSheet.findMany({
      where,
      select: {
        id: true,
        title: true,
        sequenceNumber: true,
        projectId: true,
        lastReturnComment: true,
        currentVersion: true,
        returnedAt: true,
        updatedAt: true,
        createdById: true,
        project: { select: { name: true, contractor: true } },
        createdBy: { select: { name: true } },
        approvals: {
          where: { status: "rejected" },
          orderBy: { decidedAt: "desc" },
          take: 1,
          include: { approver: { select: { id: true, name: true } } },
        },
        reviewNotes: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { author: { select: { name: true } } },
        },
      },
      orderBy: { returnedAt: "desc" },
    });

    return rows.map((r) => {
      const reject = r.approvals[0];
      const returnedAt = r.returnedAt || r.updatedAt;
      const waitingMs = Date.now() - returnedAt.getTime();
      const waitingHours = Math.max(0, Math.floor(waitingMs / 3600000));
      const waitingDays = Math.floor(waitingHours / 24);
      const waitingLabel =
        waitingDays > 0
          ? `${waitingDays} ימים`
          : waitingHours > 0
            ? `${waitingHours} שעות`
            : "פחות משעה";

      const notesForVersion = r.reviewNotes.filter(
        (n) => n.version === r.currentVersion
      );
      const notes = (notesForVersion.length ? notesForVersion : r.reviewNotes).map(
        (n) => ({
          comment: n.comment,
          authorName: n.author?.name || null,
          createdAt: n.createdAt.toISOString(),
        })
      );

      return {
        kind: "measurement_sheet" as const,
        documentId: r.id,
        documentNumber: `MS-${r.sequenceNumber}`,
        title: r.title,
        projectId: r.projectId,
        projectName: r.project?.name || null,
        clientName: r.project?.contractor || null,
        status: "revision" as const,
        statusLabel: "נדרש תיקון",
        version: r.currentVersion,
        returnedAt: returnedAt.toISOString(),
        returnedByName: reject?.approver?.name || null,
        returnedById: reject?.approverId || null,
        returnComment: r.lastReturnComment || reject?.comment || null,
        reviewNotes: notes,
        waitingLabel,
        createdByName: r.createdBy?.name || null,
        canEdit: true,
        fixHref: `?projectId=${r.projectId}&module=performance&sheetId=${r.id}`,
      };
    });
  }

  static async listRevisionForCreator(userId: string) {
    return this.listNeedingFix(userId, "FIELD_MANAGER");
  }

  static async getEntries(sheetId: string, take = 100) {
    const rows = await prisma.measurementEntry.findMany({
      where: { sheetId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      cellId: r.cellId,
      boqItemId: r.boqItemId,
      rowId: r.rowId,
      oldQuantity: r.oldQuantity != null ? num(r.oldQuantity) : null,
      newQuantity: num(r.newQuantity),
      note: r.note,
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * ריכוז חשבון: לכל סעיף — חוזה, בוצע קודם (חויב), בוצע בתקופה (דפי מדידה פתוחים), מצטבר, יתרה, סכום
   */
  static async getProjectSummary(projectId: string, sheetIds?: string[]) {
    const sheets = await prisma.measurementSheet.findMany({
      where: {
        projectId,
        ...(sheetIds?.length
          ? { id: { in: sheetIds } }
          : { status: { in: ["approved", "locked"] as MeasurementSheetStatus[] } }),
        partialInvoiceId: null,
      },
      include: {
        cells: true,
      },
    });

    if (sheetIds?.length) {
      const requested = await prisma.measurementSheet.findMany({
        where: { id: { in: sheetIds }, projectId },
        select: {
          id: true,
          status: true,
          partialInvoiceId: true,
          sequenceNumber: true,
        },
      });
      const already = requested.filter((s) => s.partialInvoiceId);
      if (already.length) {
        throw new Error(
          `כבר הופק חשבון לדף ${already
            .map((s) => `MS-${s.sequenceNumber}`)
            .join(", ")}`
        );
      }
      const invalid = requested.filter(
        (s) => s.status !== "approved" && s.status !== "locked"
      );
      if (invalid.length) {
        throw new Error(
          "ניתן להפיק חשבון רק מדוחות ביצוע שאושרו"
        );
      }
    }

    const periodByBoq = new Map<string, number>();
    for (const sheet of sheets) {
      for (const cell of sheet.cells) {
        periodByBoq.set(
          cell.boqItemId,
          (periodByBoq.get(cell.boqItemId) ?? 0) + num(cell.quantity)
        );
      }
    }

    const boqItems = await prisma.boqItem.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: "asc" },
    });

    const lines = boqItems.map((b) => {
      const contractQuantity = num(b.contractQuantity);
      const previousQuantity = num(b.invoicedQuantity);
      const periodQuantity = periodByBoq.get(b.id) ?? 0;
      const available = Math.max(0, contractQuantity - previousQuantity);
      const billable = Math.min(periodQuantity, available);
      const cumulative = previousQuantity + billable;
      const remaining = Math.max(0, contractQuantity - cumulative);
      const unitPrice = num(b.unitPrice);
      return {
        boqItemId: b.id,
        code: b.code,
        description: b.description,
        unit: b.unit,
        unitPrice,
        contractQuantity,
        previousQuantity,
        periodQuantity,
        billableQuantity: billable,
        cumulativeQuantity: cumulative,
        remainingQuantity: remaining,
        amount: billable * unitPrice,
        itemKind: b.itemKind,
      };
    });

    const billableLines = lines.filter((l) => l.billableQuantity > 0);
    const subtotal = billableLines.reduce((s, l) => s + l.amount, 0);

    return {
      projectId,
      sheetIds: sheets.map((s) => s.id),
      sheetTitles: sheets.map((s) => s.title),
      lines,
      billableLines,
      subtotal,
    };
  }

  static async generateInvoice(
    projectId: string,
    input: {
      sheetIds?: string[];
      billingMonth?: string;
      createDocumentFolder?: boolean;
      notes?: string;
    },
    userId: string
  ) {
    if (input.sheetIds?.length) {
      const sourceSheets = await prisma.measurementSheet.findMany({
        where: { id: { in: input.sheetIds }, projectId },
        select: {
          id: true,
          title: true,
          status: true,
          partialInvoiceId: true,
          sequenceNumber: true,
        },
      });
      if (sourceSheets.length !== input.sheetIds.length) {
        throw new Error("חלק מדפי המדידה לא נמצאו בפרויקט");
      }
      const alreadyInvoiced = sourceSheets.filter((s) => s.partialInvoiceId);
      if (alreadyInvoiced.length) {
        throw new Error(
          `כבר הופק חשבון לדף מדידה ${alreadyInvoiced
            .map((s) => `MS-${s.sequenceNumber}`)
            .join(", ")} — פתחו את החשבון הקיים במקום ליצור חדש`
        );
      }
      const notApproved = sourceSheets.filter(
        (s) => s.status !== "approved" && s.status !== "locked"
      );
      if (notApproved.length) {
        throw new Error(
          "ניתן להפיק חשבון רק מדף מדידה שאושר. דפים שלא אושרו: " +
            notApproved.map((s) => `MS-${s.sequenceNumber}`).join(", ")
        );
      }
    }

    const summary = await this.getProjectSummary(projectId, input.sheetIds);
    if (!summary.billableLines.length) {
      throw new Error("אין כמויות לחיוב בדפי המדידה שנבחרו");
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new Error("פרויקט לא נמצא");

    // דפי מדידה הם מקור הביצוע — מעדכנים completed לפני/עם החיוב
    for (const line of summary.billableLines) {
      const boq = await prisma.boqItem.findUnique({ where: { id: line.boqItemId } });
      if (!boq) continue;
      const completed = Math.max(num(boq.completedQuantity), line.cumulativeQuantity);
      const contract = num(boq.contractQuantity);
      const remaining = Math.max(0, contract - completed);
      const unitPrice = num(boq.unitPrice);
      await prisma.boqItem.update({
        where: { id: line.boqItemId },
        data: {
          completedQuantity: completed,
          remainingQuantity: remaining,
          completedValue: completed * unitPrice,
          remainingValue: remaining * unitPrice,
          progress: contract > 0 ? Math.min(100, (completed / contract) * 100) : 0,
          updatedById: userId,
        },
      });
    }

    const invoice = await PartialInvoicesRepository.create(
      {
        projectId,
        date: new Date().toISOString().slice(0, 10),
        billingMonth: input.billingMonth,
        billTo: project.contractor,
        contractor: project.contractor,
        notes: input.notes ?? `הופק מדפי מדידה: ${summary.sheetTitles.join(", ")}`,
        status: "draft",
        quantitySource: "measurement",
        items: summary.billableLines.map((l) => ({
          boqItemId: l.boqItemId,
          quantity: l.billableQuantity,
        })),
      },
      userId
    );

    await prisma.measurementSheet.updateMany({
      where: { id: { in: summary.sheetIds } },
      data: {
        status: "invoiced",
        partialInvoiceId: invoice.id,
        updatedById: userId,
      },
    });

    for (const sid of summary.sheetIds) {
      await this.ensureDocument(sid, userId, "invoiced");
      await this.addEvent(sid, "invoiced", "הופק לחשבון", userId, {
        invoiceId: invoice.id,
      });
    }

    let documentFolder: string | null = null;
    if (input.createDocumentFolder !== false) {
      documentFolder = `חשבון ${invoice.sequenceNumber}`;
      // Placeholder marker document so the folder appears in project docs
      await prisma.document.create({
        data: {
          projectId,
          name: `${documentFolder} — תיקיית חשבון`,
          type: "other",
          extension: "folder",
          size: 0,
          bucket: "documents",
          path: `folders/${projectId}/${documentFolder}`,
          url: "",
          folderPath: documentFolder,
          partialInvoiceId: invoice.id,
          uploadedById: userId,
          ownerId: userId,
          createdById: userId,
          updatedById: userId,
        },
      });
    }

    return {
      invoice,
      summary,
      documentFolder,
    };
  }

  static async updateProjectAxis(
    projectId: string,
    input: { measurementAxisType: MeasurementAxisType; measurementAxisLabel?: string | null }
  ) {
    return prisma.project.update({
      where: { id: projectId },
      data: {
        measurementAxisType: input.measurementAxisType,
        measurementAxisLabel: input.measurementAxisLabel ?? null,
      },
      select: {
        id: true,
        measurementAxisType: true,
        measurementAxisLabel: true,
      },
    });
  }

  static async getProjectTree(projectId: string) {
    const result = await this.getProjectTreeForOffice(projectId, null);
    if (result.status === "not_found") return null;
    if (result.status === "forbidden") return null;
    return result.data;
  }

  /**
   * Invoice workspace tree — one SQL round-trip (auth optional + tree payload).
   * Same response shape as legacy getProjectTree.
   */
  static async getProjectTreeForOffice(
    projectId: string,
    officeUserId: string | null
  ): Promise<
    | { status: "ok"; data: ReturnType<typeof MeasurementSheetsRepository.getProjectTreeMapped> }
    | { status: "not_found" }
    | { status: "forbidden" }
  > {
    type TreeRow = {
      authUserId: string | null;
      project: unknown;
      boqCount: number;
      sheets: unknown;
      invoices: unknown;
      documents: unknown;
      subtotal: unknown;
      billableLineCount: number;
      openSheetCount: number;
    };

    const rows = officeUserId
      ? await prisma.$queryRaw<TreeRow[]>`
          WITH auth AS (
            SELECT u.id AS user_id
            FROM "User" u
            LEFT JOIN "Employee" emp ON emp."userId" = u.id
            WHERE u.id = ${officeUserId}
              AND u."passwordHash" IS NOT NULL
              AND u.role IN (
                'PROJECT_MANAGER','OPERATIONS_MANAGER','ADMIN','SYSTEM_MANAGER','admin','מנהל מערכת'
              )
              AND (
                emp.id IS NULL
                OR (emp."isDeleted" = false AND emp.status = 'active')
              )
          ),
          proj AS (
            SELECT
              p.id, p.name, p.contractor, p.location,
              p."measurementAxisType", p."measurementAxisLabel",
              (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
            FROM "Project" p
            WHERE p.id = ${projectId}
          ),
          boq AS (
            SELECT COUNT(*)::int AS cnt
            FROM "BoqItem"
            WHERE "projectId" = ${projectId} AND "deletedAt" IS NULL
          ),
          sheets AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'sequenceNumber', s."sequenceNumber",
                  'status', s.status,
                  'currentVersion', s."currentVersion",
                  'partialInvoiceId', s."partialInvoiceId",
                  'updatedAt', s."updatedAt",
                  'rowCount', (SELECT COUNT(*)::int FROM "MeasurementSheetRow" r WHERE r."sheetId" = s.id),
                  'cellCount', (SELECT COUNT(*)::int FROM "MeasurementCell" c WHERE c."sheetId" = s.id)
                )
                ORDER BY s."sequenceNumber" ASC
              ),
              '[]'::json
            ) AS items
            FROM "MeasurementSheet" s
            WHERE s."projectId" = ${projectId}
          ),
          docs AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'name', d.name,
                  'folderPath', d."folderPath",
                  'type', d.type,
                  'url', d.url,
                  'partialInvoiceId', d."partialInvoiceId",
                  'createdAt', d."createdAt"
                )
                ORDER BY d."createdAt" DESC
              ),
              '[]'::json
            ) AS items
            FROM (
              SELECT id, name, "folderPath", type, url, "partialInvoiceId", "createdAt"
              FROM "Document"
              WHERE "projectId" = ${projectId}
              ORDER BY "createdAt" DESC
              LIMIT 50
            ) d
          ),
          inv AS (
            SELECT COALESCE(
              json_agg(inv_row ORDER BY seq DESC),
              '[]'::json
            ) AS items
            FROM (
              SELECT
                i."sequenceNumber" AS seq,
                json_build_object(
                  'id', i.id,
                  'projectId', i."projectId",
                  'invoiceNumber', i."invoiceNumber",
                  'sequenceNumber', i."sequenceNumber",
                  'billingMonth', i."billingMonth",
                  'billTo', i."billTo",
                  'contractor', i.contractor,
                  'amount', i.amount,
                  'subtotal', i.subtotal,
                  'vatPercent', i."vatPercent",
                  'vatAmount', i."vatAmount",
                  'totalWithVat', i."totalWithVat",
                  'status', i.status,
                  'date', i.date,
                  'dueDate', i."dueDate",
                  'notes', i.notes,
                  'url', i.url,
                  'createdAt', i."createdAt",
                  'project', json_build_object(
                    'name', p.name,
                    'contractNumber', p."contractNumber",
                    'location', p.location,
                    'foreman', CASE
                      WHEN f.id IS NULL THEN NULL
                      ELSE json_build_object(
                        'firstName', f."firstName",
                        'lastName', f."lastName"
                      )
                    END
                  ),
                  'items', COALESCE((
                    SELECT json_agg(
                      json_build_object(
                        'id', it.id,
                        'boqItemId', it."boqItemId",
                        'code', it.code,
                        'description', it.description,
                        'unit', it.unit,
                        'contractQuantity', it."contractQuantity",
                        'previousQuantity', it."previousQuantity",
                        'quantity', it.quantity,
                        'cumulativeQuantity', it."cumulativeQuantity",
                        'quantityPercent', it."quantityPercent",
                        'unitPrice', it."unitPrice",
                        'total', it.total,
                        'cumulativeAmount', it."cumulativeAmount",
                        'financialPercent', it."financialPercent"
                      )
                      ORDER BY it.id
                    )
                    FROM "InvoiceItem" it
                    WHERE it."invoiceId" = i.id
                  ), '[]'::json)
                ) AS inv_row
              FROM "PartialInvoice" i
              INNER JOIN "Project" p ON p.id = i."projectId"
              LEFT JOIN "Employee" f ON f.id = p."foremanId"
              WHERE i."projectId" = ${projectId}
            ) x
          ),
          open_sheets AS (
            SELECT s.id, s.title
            FROM "MeasurementSheet" s
            WHERE s."projectId" = ${projectId}
              AND s.status IN ('approved', 'locked')
              AND s."partialInvoiceId" IS NULL
          ),
          period AS (
            SELECT c."boqItemId" AS id, SUM(c.quantity) AS qty
            FROM "MeasurementCell" c
            INNER JOIN open_sheets os ON os.id = c."sheetId"
            GROUP BY c."boqItemId"
          ),
          billable AS (
            SELECT
              COUNT(*) FILTER (
                WHERE GREATEST(
                  0,
                  LEAST(
                    COALESCE(p.qty, 0),
                    GREATEST(0, b."contractQuantity" - b."invoicedQuantity")
                  )
                ) > 0
              )::int AS line_count,
              COALESCE(
                SUM(
                  GREATEST(
                    0,
                    LEAST(
                      COALESCE(p.qty, 0),
                      GREATEST(0, b."contractQuantity" - b."invoicedQuantity")
                    )
                  ) * b."unitPrice"
                ),
                0
              ) AS subtotal
            FROM "BoqItem" b
            LEFT JOIN period p ON p.id = b.id
            WHERE b."projectId" = ${projectId} AND b."deletedAt" IS NULL
          )
          SELECT
            pr."authUserId",
            json_build_object(
              'id', pr.id,
              'name', pr.name,
              'contractor', pr.contractor,
              'location', pr.location,
              'measurementAxisType', pr."measurementAxisType",
              'measurementAxisLabel', pr."measurementAxisLabel"
            ) AS project,
            (SELECT cnt FROM boq) AS "boqCount",
            (SELECT items FROM sheets) AS sheets,
            (SELECT items FROM inv) AS invoices,
            (SELECT items FROM docs) AS documents,
            (SELECT subtotal FROM billable) AS subtotal,
            (SELECT line_count FROM billable) AS "billableLineCount",
            (SELECT COUNT(*)::int FROM open_sheets) AS "openSheetCount"
          FROM proj pr
        `
      : await prisma.$queryRaw<TreeRow[]>`
          WITH proj AS (
            SELECT
              p.id, p.name, p.contractor, p.location,
              p."measurementAxisType", p."measurementAxisLabel",
              NULL::text AS "authUserId"
            FROM "Project" p
            WHERE p.id = ${projectId}
          ),
          boq AS (
            SELECT COUNT(*)::int AS cnt
            FROM "BoqItem"
            WHERE "projectId" = ${projectId} AND "deletedAt" IS NULL
          ),
          sheets AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'sequenceNumber', s."sequenceNumber",
                  'status', s.status,
                  'currentVersion', s."currentVersion",
                  'partialInvoiceId', s."partialInvoiceId",
                  'updatedAt', s."updatedAt",
                  'rowCount', (SELECT COUNT(*)::int FROM "MeasurementSheetRow" r WHERE r."sheetId" = s.id),
                  'cellCount', (SELECT COUNT(*)::int FROM "MeasurementCell" c WHERE c."sheetId" = s.id)
                )
                ORDER BY s."sequenceNumber" ASC
              ),
              '[]'::json
            ) AS items
            FROM "MeasurementSheet" s
            WHERE s."projectId" = ${projectId}
          ),
          docs AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'name', d.name,
                  'folderPath', d."folderPath",
                  'type', d.type,
                  'url', d.url,
                  'partialInvoiceId', d."partialInvoiceId",
                  'createdAt', d."createdAt"
                )
                ORDER BY d."createdAt" DESC
              ),
              '[]'::json
            ) AS items
            FROM (
              SELECT id, name, "folderPath", type, url, "partialInvoiceId", "createdAt"
              FROM "Document"
              WHERE "projectId" = ${projectId}
              ORDER BY "createdAt" DESC
              LIMIT 50
            ) d
          ),
          inv AS (
            SELECT COALESCE(
              json_agg(inv_row ORDER BY seq DESC),
              '[]'::json
            ) AS items
            FROM (
              SELECT
                i."sequenceNumber" AS seq,
                json_build_object(
                  'id', i.id,
                  'projectId', i."projectId",
                  'invoiceNumber', i."invoiceNumber",
                  'sequenceNumber', i."sequenceNumber",
                  'billingMonth', i."billingMonth",
                  'billTo', i."billTo",
                  'contractor', i.contractor,
                  'amount', i.amount,
                  'subtotal', i.subtotal,
                  'vatPercent', i."vatPercent",
                  'vatAmount', i."vatAmount",
                  'totalWithVat', i."totalWithVat",
                  'status', i.status,
                  'date', i.date,
                  'dueDate', i."dueDate",
                  'notes', i.notes,
                  'url', i.url,
                  'createdAt', i."createdAt",
                  'project', json_build_object(
                    'name', p.name,
                    'contractNumber', p."contractNumber",
                    'location', p.location,
                    'foreman', CASE
                      WHEN f.id IS NULL THEN NULL
                      ELSE json_build_object(
                        'firstName', f."firstName",
                        'lastName', f."lastName"
                      )
                    END
                  ),
                  'items', COALESCE((
                    SELECT json_agg(
                      json_build_object(
                        'id', it.id,
                        'boqItemId', it."boqItemId",
                        'code', it.code,
                        'description', it.description,
                        'unit', it.unit,
                        'contractQuantity', it."contractQuantity",
                        'previousQuantity', it."previousQuantity",
                        'quantity', it.quantity,
                        'cumulativeQuantity', it."cumulativeQuantity",
                        'quantityPercent', it."quantityPercent",
                        'unitPrice', it."unitPrice",
                        'total', it.total,
                        'cumulativeAmount', it."cumulativeAmount",
                        'financialPercent', it."financialPercent"
                      )
                      ORDER BY it.id
                    )
                    FROM "InvoiceItem" it
                    WHERE it."invoiceId" = i.id
                  ), '[]'::json)
                ) AS inv_row
              FROM "PartialInvoice" i
              INNER JOIN "Project" p ON p.id = i."projectId"
              LEFT JOIN "Employee" f ON f.id = p."foremanId"
              WHERE i."projectId" = ${projectId}
            ) x
          ),
          open_sheets AS (
            SELECT s.id, s.title
            FROM "MeasurementSheet" s
            WHERE s."projectId" = ${projectId}
              AND s.status IN ('approved', 'locked')
              AND s."partialInvoiceId" IS NULL
          ),
          period AS (
            SELECT c."boqItemId" AS id, SUM(c.quantity) AS qty
            FROM "MeasurementCell" c
            INNER JOIN open_sheets os ON os.id = c."sheetId"
            GROUP BY c."boqItemId"
          ),
          billable AS (
            SELECT
              COUNT(*) FILTER (
                WHERE GREATEST(
                  0,
                  LEAST(
                    COALESCE(p.qty, 0),
                    GREATEST(0, b."contractQuantity" - b."invoicedQuantity")
                  )
                ) > 0
              )::int AS line_count,
              COALESCE(
                SUM(
                  GREATEST(
                    0,
                    LEAST(
                      COALESCE(p.qty, 0),
                      GREATEST(0, b."contractQuantity" - b."invoicedQuantity")
                    )
                  ) * b."unitPrice"
                ),
                0
              ) AS subtotal
            FROM "BoqItem" b
            LEFT JOIN period p ON p.id = b.id
            WHERE b."projectId" = ${projectId} AND b."deletedAt" IS NULL
          )
          SELECT
            pr."authUserId",
            json_build_object(
              'id', pr.id,
              'name', pr.name,
              'contractor', pr.contractor,
              'location', pr.location,
              'measurementAxisType', pr."measurementAxisType",
              'measurementAxisLabel', pr."measurementAxisLabel"
            ) AS project,
            (SELECT cnt FROM boq) AS "boqCount",
            (SELECT items FROM sheets) AS sheets,
            (SELECT items FROM inv) AS invoices,
            (SELECT items FROM docs) AS documents,
            (SELECT subtotal FROM billable) AS subtotal,
            (SELECT line_count FROM billable) AS "billableLineCount",
            (SELECT COUNT(*)::int FROM open_sheets) AS "openSheetCount"
          FROM proj pr
        `;

    const row = rows[0];
    if (!row?.project) return { status: "not_found" };
    if (officeUserId && !row.authUserId) return { status: "forbidden" };

    const data = this.getProjectTreeMapped(row);
    return { status: "ok", data };
  }

  private static getProjectTreeMapped(row: {
    project: unknown;
    boqCount: number;
    sheets: unknown;
    invoices: unknown;
    documents: unknown;
    subtotal: unknown;
    billableLineCount: number;
    openSheetCount: number;
  }) {
    const project =
      typeof row.project === "string" ? JSON.parse(row.project) : row.project;
    const sheets = parseJsonArray(row.sheets).map((s: any) => ({
      id: s.id,
      title: s.title,
      sequenceNumber: s.sequenceNumber,
      status: s.status,
      currentVersion: s.currentVersion,
      partialInvoiceId: s.partialInvoiceId,
      updatedAt: iso(s.updatedAt) ?? new Date(0).toISOString(),
      rowCount: num(s.rowCount),
      cellCount: num(s.cellCount),
    }));
    const documents = parseJsonArray(row.documents).map((d: any) => ({
      id: d.id,
      name: d.name,
      folderPath: d.folderPath,
      type: d.type,
      url: d.url,
      partialInvoiceId: d.partialInvoiceId,
      createdAt: iso(d.createdAt) ?? new Date(0).toISOString(),
    }));
    const invoices = parseJsonArray(row.invoices).map((inv: any) => {
      const foreman = inv.project?.foreman;
      return {
        id: inv.id,
        projectId: inv.projectId,
        projectName: inv.project?.name,
        projectContractNumber: inv.project?.contractNumber,
        projectLocation: inv.project?.location,
        projectForemanName: foreman
          ? `${foreman.firstName ?? ""} ${foreman.lastName ?? ""}`.trim()
          : undefined,
        invoiceNumber: inv.invoiceNumber,
        sequenceNumber: inv.sequenceNumber ?? 0,
        billingMonth: inv.billingMonth ?? "",
        billTo: inv.billTo ?? undefined,
        contractor: inv.contractor ?? undefined,
        amount: num(inv.amount),
        subtotal: inv.subtotal != null ? num(inv.subtotal) : null,
        vatPercent: inv.vatPercent != null ? num(inv.vatPercent) : null,
        vatAmount: inv.vatAmount != null ? num(inv.vatAmount) : null,
        totalWithVat: inv.totalWithVat != null ? num(inv.totalWithVat) : null,
        status: inv.status,
        date: iso(inv.date) ?? new Date(0).toISOString(),
        dueDate: iso(inv.dueDate) ?? new Date(0).toISOString(),
        includedItems: parseJsonArray(inv.items).map((item: any) => ({
          id: item.id,
          boqItemId: item.boqItemId,
          code: item.code,
          description: item.description,
          unit: item.unit ?? "יח'",
          contractQuantity: num(item.contractQuantity ?? 0),
          previousQuantity: num(item.previousQuantity ?? 0),
          quantity: num(item.quantity),
          cumulativeQuantity: num(item.cumulativeQuantity ?? item.quantity),
          quantityPercent: item.quantityPercent ?? 0,
          unitPrice: num(item.unitPrice),
          total: num(item.total),
          cumulativeAmount: num(item.cumulativeAmount ?? item.total),
          financialPercent: item.financialPercent ?? 0,
        })),
        notes: inv.notes ?? undefined,
        url: inv.url ?? undefined,
        createdAt: iso(inv.createdAt) ?? new Date(0).toISOString(),
      };
    });

    const axisType = project.measurementAxisType as MeasurementAxisType;
    return {
      project: {
        id: project.id,
        name: project.name,
        contractor: project.contractor,
        location: project.location,
        measurementAxisType: project.measurementAxisType,
        measurementAxisLabel: project.measurementAxisLabel,
        axisLabel:
          project.measurementAxisLabel ||
          AXIS_LABELS[axisType] ||
          "יחידה",
      },
      boqCount: num(row.boqCount),
      sheets,
      invoices,
      documents,
      summary: {
        subtotal: num(row.subtotal),
        billableLineCount: num(row.billableLineCount),
        openSheetCount: num(row.openSheetCount),
      },
    };
  }
}
