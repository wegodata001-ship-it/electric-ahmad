import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS_LABELS } from "@/constants";
import type { InvoiceStatus } from "@/types";

function num(v: unknown) {
  return Number(v ?? 0);
}

function iso(d: Date | string | null | undefined) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

type InvoiceItemRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: unknown;
  sequenceNumber: number;
};

type HubSqlRow = {
  id: string;
  name: string;
  contractNumber: string;
  contractor: string;
  location: string;
  status: string;
  progress: number;
  financialProgress: number;
  contractValue: unknown;
  completedValue: unknown;
  invoicedValue: unknown;
  measurementAxisType: string;
  measurementAxisLabel: string | null;
  foremanId: string | null;
  foremanFirstName: string | null;
  foremanLastName: string | null;
  boqItemCount: number;
  boqCompletedQty: unknown;
  boqAvgProgress: unknown;
  sheetCount: number;
  cellCount: number;
  entryCount: number;
  lastEntryAt: Date | null;
  unitCount: number;
  invoiceTotal: number;
  invoiceDraft: number;
  invoicePending: number;
  invoiceApproved: number;
  invoiceSent: number;
  invoicePaid: number;
  invoiceInvoicedSum: unknown;
  invoiceItems: InvoiceItemRow[] | null;
  documentTotal: number;
  documentRecent: number;
  diaryTotal: number;
  diaryLastAt: Date | null;
  deliveryTotal: number;
  deliveryOpen: number;
  /** Set when officeUserId was supplied — null means auth gate failed */
  authUserId: string | null;
};

export type ProjectHubResult =
  | { status: "ok"; data: NonNullable<Awaited<ReturnType<typeof mapHubRow>>> }
  | { status: "not_found" }
  | { status: "forbidden" };

function mapHubRow(row: HubSqlRow) {
  const boqCount = num(row.boqItemCount);
  const completedQty = num(row.boqCompletedQty);
  const avgProgress =
    boqCount > 0 ? num(row.boqAvgProgress) : num(row.progress);

  const entryCount = num(row.entryCount);
  const cellCount = num(row.cellCount);
  const reportCount = entryCount || cellCount || 0;

  const invoicedSum = num(row.invoiceInvoicedSum);

  const axisLabel =
    row.measurementAxisLabel ||
    (
      {
        room: "חדרים",
        floor: "קומות",
        building: "בניינים",
        area: "אזורים",
        custom: "יחידות",
      } as const
    )[row.measurementAxisType as "room" | "floor" | "building" | "area" | "custom"] ||
    "יחידות";

  const foremanName =
    row.foremanFirstName || row.foremanLastName
      ? `${row.foremanFirstName ?? ""} ${row.foremanLastName ?? ""}`.trim()
      : "";

  let invoiceItems: InvoiceItemRow[] = [];
  const rawItems = row.invoiceItems;
  if (Array.isArray(rawItems)) {
    invoiceItems = rawItems;
  } else if (typeof rawItems === "string") {
    try {
      invoiceItems = JSON.parse(rawItems) as InvoiceItemRow[];
    } catch {
      invoiceItems = [];
    }
  }

  return {
    project: {
      id: row.id,
      name: row.name,
      contractNumber: row.contractNumber,
      contractor: row.contractor,
      location: row.location,
      status: row.status,
      progress: avgProgress,
      financialProgress: num(row.financialProgress),
      contractValue: num(row.contractValue),
      completedValue: num(row.completedValue),
      invoicedValue: num(row.invoicedValue),
      measurementAxisType: row.measurementAxisType,
      axisLabel,
      foremanName,
      foremanId: row.foremanId ?? null,
    },
    cards: {
      boq: {
        itemCount: boqCount,
        completedQuantity: completedQty,
        progressPercent: avgProgress,
      },
      performance: {
        unitCount: num(row.unitCount),
        sheetCount: num(row.sheetCount),
        reportCount,
        lastReportAt: iso(row.lastEntryAt),
      },
      invoices: {
        total: num(row.invoiceTotal),
        draft: num(row.invoiceDraft),
        pending: num(row.invoicePending),
        approved: num(row.invoiceApproved),
        sent: num(row.invoiceSent),
        paid: num(row.invoicePaid),
        invoicedAmount: invoicedSum || num(row.invoicedValue),
        items: invoiceItems.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          statusLabel:
            INVOICE_STATUS_LABELS[i.status as InvoiceStatus] ?? i.status,
          amount: num(i.amount),
        })),
      },
      documents: {
        total: num(row.documentTotal),
        recent: num(row.documentRecent),
      },
      workDiaries: {
        total: num(row.diaryTotal),
        lastAt: iso(row.diaryLastAt),
      },
      deliveries: {
        total: num(row.deliveryTotal),
        open: num(row.deliveryOpen),
      },
    },
  };
}

/**
 * Project hub KPIs — one SQL round-trip:
 * office-user auth gate + project + aggregates + invoice preview.
 * Response `data` shape unchanged from P1.
 */
export class ProjectHubRepository {
  static async getHub(
    projectId: string,
    officeUserId: string
  ): Promise<ProjectHubResult> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<HubSqlRow[]>`
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
      boq AS (
        SELECT
          COUNT(*)::int AS item_count,
          COALESCE(SUM("completedQuantity"), 0) AS completed_qty,
          CASE
            WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(
              (SUM(COALESCE(progress, 0)) / COUNT(*))::numeric,
              1
            )
          END AS avg_progress
        FROM "BoqItem"
        WHERE "projectId" = ${projectId}
          AND "deletedAt" IS NULL
      ),
      sheets AS (
        SELECT COUNT(*)::int AS sheet_count
        FROM "MeasurementSheet"
        WHERE "projectId" = ${projectId}
      ),
      cells AS (
        SELECT COUNT(*)::int AS cell_count
        FROM "MeasurementCell" c
        INNER JOIN "MeasurementSheet" s ON s.id = c."sheetId"
        WHERE s."projectId" = ${projectId}
      ),
      entries AS (
        SELECT
          COUNT(*)::int AS entry_count,
          MAX(e."createdAt") AS last_entry_at
        FROM "MeasurementEntry" e
        INNER JOIN "MeasurementSheet" s ON s.id = e."sheetId"
        WHERE s."projectId" = ${projectId}
      ),
      inv AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
          COUNT(*) FILTER (WHERE status = 'pending_foreman_approval')::int AS pending,
          COUNT(*) FILTER (
            WHERE status IN ('approved_by_foreman', 'approved')
          )::int AS approved,
          COUNT(*) FILTER (
            WHERE status IN ('sent_to_client', 'signed')
          )::int AS sent,
          COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
          COALESCE(
            SUM(amount) FILTER (
              WHERE status IN (
                'approved_by_foreman',
                'approved',
                'sent_to_client',
                'signed',
                'paid'
              )
            ),
            0
          ) AS invoiced_sum
        FROM "PartialInvoice"
        WHERE "projectId" = ${projectId}
      ),
      inv_items AS (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'invoiceNumber', i."invoiceNumber",
              'status', i.status,
              'amount', i.amount,
              'sequenceNumber', i."sequenceNumber"
            )
            ORDER BY i."sequenceNumber" DESC
          ),
          '[]'::json
        ) AS items
        FROM (
          SELECT id, "invoiceNumber", status, amount, "sequenceNumber"
          FROM "PartialInvoice"
          WHERE "projectId" = ${projectId}
          ORDER BY "sequenceNumber" DESC
          LIMIT 8
        ) i
      ),
      docs AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "createdAt" >= ${weekAgo})::int AS recent
        FROM "Document"
        WHERE "projectId" = ${projectId}
      ),
      diaries AS (
        SELECT
          COUNT(*)::int AS total,
          MAX("workDate") AS last_at
        FROM "WorkDiary"
        WHERE "projectId" = ${projectId}
          AND "deletedAt" IS NULL
      ),
      deliveries AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE status IN ('draft', 'pending_approval', 'revision')
          )::int AS open
        FROM "OpsDeliveryNote"
        WHERE "projectId" = ${projectId}
          AND "deletedAt" IS NULL
      ),
      rooms AS (
        SELECT COUNT(*)::int AS unit_count
        FROM "ProjectRoom"
        WHERE "projectId" = ${projectId}
          AND "deletedAt" IS NULL
          AND "isHidden" = false
      )
      SELECT
        p.id,
        p.name,
        p."contractNumber" AS "contractNumber",
        p.contractor,
        p.location,
        p.status::text AS status,
        p.progress,
        p."financialProgress" AS "financialProgress",
        p."contractValue" AS "contractValue",
        p."completedValue" AS "completedValue",
        p."invoicedValue" AS "invoicedValue",
        p."measurementAxisType"::text AS "measurementAxisType",
        p."measurementAxisLabel" AS "measurementAxisLabel",
        e.id AS "foremanId",
        e."firstName" AS "foremanFirstName",
        e."lastName" AS "foremanLastName",
        boq.item_count AS "boqItemCount",
        boq.completed_qty AS "boqCompletedQty",
        boq.avg_progress AS "boqAvgProgress",
        sheets.sheet_count AS "sheetCount",
        cells.cell_count AS "cellCount",
        entries.entry_count AS "entryCount",
        entries.last_entry_at AS "lastEntryAt",
        rooms.unit_count AS "unitCount",
        inv.total AS "invoiceTotal",
        inv.draft AS "invoiceDraft",
        inv.pending AS "invoicePending",
        inv.approved AS "invoiceApproved",
        inv.sent AS "invoiceSent",
        inv.paid AS "invoicePaid",
        inv.invoiced_sum AS "invoiceInvoicedSum",
        inv_items.items AS "invoiceItems",
        docs.total AS "documentTotal",
        docs.recent AS "documentRecent",
        diaries.total AS "diaryTotal",
        diaries.last_at AS "diaryLastAt",
        deliveries.total AS "deliveryTotal",
        deliveries.open AS "deliveryOpen",
        auth.user_id AS "authUserId"
      FROM "Project" p
      LEFT JOIN "Employee" e ON e.id = p."foremanId"
      LEFT JOIN auth ON true
      CROSS JOIN boq
      CROSS JOIN sheets
      CROSS JOIN cells
      CROSS JOIN entries
      CROSS JOIN inv
      CROSS JOIN inv_items
      CROSS JOIN docs
      CROSS JOIN diaries
      CROSS JOIN deliveries
      CROSS JOIN rooms
      WHERE p.id = ${projectId}
    `;

    const row = rows[0];
    if (!row) return { status: "not_found" };
    if (!row.authUserId) return { status: "forbidden" };
    return { status: "ok", data: mapHubRow(row) };
  }
}
