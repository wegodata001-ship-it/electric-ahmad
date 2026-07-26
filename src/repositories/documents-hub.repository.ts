import { prisma } from "@/lib/prisma";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import {
  mapLegacyDiaryStatusToWorkflow,
  syncWorkDiaryArchiveDocument,
} from "@/lib/workflow/work-diary-documents";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import {
  kindLabel,
  resolveHubFolder,
  statusUi,
  type HubDocKind,
  type HubFolderId,
} from "@/lib/documents/hub-folders";
import {
  buildPageInfo,
  encodeTimeIdCursor,
  type ListPageInfo,
} from "@/lib/api/list-query";

export type HubListItem = {
  hubKey: string;
  kind: HubDocKind;
  entityId: string;
  documentId: string | null;
  workflowDocumentId: string | null;
  title: string;
  documentNumber: string | null;
  status: string;
  statusLabel: string;
  statusTone: string;
  folderId: HubFolderId;
  projectId: string;
  projectName: string | null;
  inArchive: boolean;
  url: string | null;
  updatedAt: string;
  createdAt: string;
  creatorName: string | null;
};

export type DocumentsHubListResult =
  | {
      status: "ok";
      items: HubListItem[];
      pageInfo?: ListPageInfo;
      folderCounts?: Record<string, number>;
    }
  | { status: "forbidden" };

export type DocumentsArchiveListItem = {
  id: string;
  kind: "work_diary" | "delivery_note";
  documentNumber: string;
  status: string;
  statusLabel?: string;
  workflowDocumentId?: string | null;
  workDate: string;
  clientName: string | null;
  project: { id: string; name: string } | null;
  foreman: { id: string; name: string } | null;
  approverName: string | null;
  clientSignedAt: string | null;
  createdAt: string;
};

export type DocumentsArchiveListResult =
  | { status: "ok"; items: DocumentsArchiveListItem[] }
  | { status: "forbidden" };

type HubSqlRow = {
  kind: string;
  entityId: string | null;
  documentId: string | null;
  workflowDocumentId: string | null;
  title: string | null;
  documentNumber: string | null;
  sequenceNumber: number | null;
  status: string | null;
  legacyStatus: string | null;
  projectId: string | null;
  projectName: string | null;
  url: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
  creatorName: string | null;
  sourceType: string | null;
  folderPath: string | null;
  docType: string | null;
  authUserId: string | null;
  hubFolder: string | null;
  _total: bigint | number | null;
};

type ArchiveSqlRow = {
  kind: string;
  id: string | null;
  documentNumber: string | null;
  status: string | null;
  legacyStatus: string | null;
  workflowDocumentId: string | null;
  workDate: Date | string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  foremanId: string | null;
  foremanName: string | null;
  approverName: string | null;
  clientSignedAt: Date | null;
  createdAt: Date | null;
  authUserId: string | null;
};

function hubKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export class DocumentsHubRepository {
  /**
   * Hot path: office auth + diaries/notes/sheets/invoices/files + archive links
   * in one SQL round-trip. Response shape unchanged: { items }.
   */
  static async listForOffice(
    officeUserId: string,
    opts: {
      projectId?: string;
      q?: string;
      folderId?: string;
      take?: number;
      skip?: number;
      cursor?: string | null;
    }
  ): Promise<DocumentsHubListResult> {
    const take = Math.max(1, Math.min(opts.take ?? 300, 500));
    const skip = Math.max(0, opts.skip ?? 0);
    const projectId = opts.projectId ?? null;
    const trimmedQ = opts.q?.trim() || null;
    const qLike = trimmedQ ? `%${trimmedQ}%` : null;
    const folderIdParam =
      opts.folderId && opts.folderId !== "all" ? opts.folderId : null;

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
      archive AS (
        SELECT DISTINCT ON (a."sourceType", a."sourceId")
          a.id,
          a.url,
          a."sourceType",
          a."sourceId"
        FROM "Document" a
        WHERE EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR a."projectId" = ${projectId})
          AND a."sourceType" IN (
            'work_diary',
            'delivery_note',
            'measurement_sheet',
            'partial_invoice',
            'invoice'
          )
          AND a."sourceId" IS NOT NULL
        ORDER BY a."sourceType", a."sourceId", a."updatedAt" DESC
      ),
      diaries AS (
        SELECT
          'work_diary'::text AS kind,
          d.id AS "entityId",
          arch.id AS "documentId",
          d."workflowDocumentId" AS "workflowDocumentId",
          NULL::text AS title,
          d."documentNumber" AS "documentNumber",
          NULL::int AS "sequenceNumber",
          COALESCE(wd.status::text, d.status::text) AS status,
          d.status::text AS "legacyStatus",
          d."projectId" AS "projectId",
          p.name AS "projectName",
          arch.url AS url,
          d."updatedAt" AS "updatedAt",
          d."createdAt" AS "createdAt",
          NULLIF(BTRIM(CONCAT(e."firstName", ' ', e."lastName")), '') AS "creatorName",
          NULL::text AS "sourceType",
          NULL::text AS "folderPath",
          NULL::text AS "docType",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "WorkDiary" d
        LEFT JOIN "WorkflowDocument" wd ON wd.id = d."workflowDocumentId"
        LEFT JOIN "Project" p ON p.id = d."projectId"
        LEFT JOIN "Employee" e ON e.id = d."foremanId"
        LEFT JOIN archive arch
          ON arch."sourceType" = 'work_diary' AND arch."sourceId" = d.id
        WHERE d."deletedAt" IS NULL
          AND EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR d."projectId" = ${projectId})
      ),
      notes AS (
        SELECT
          'delivery_note'::text AS kind,
          n.id AS "entityId",
          arch.id AS "documentId",
          NULL::text AS "workflowDocumentId",
          NULL::text AS title,
          n."documentNumber" AS "documentNumber",
          NULL::int AS "sequenceNumber",
          n.status::text AS status,
          NULL::text AS "legacyStatus",
          n."projectId" AS "projectId",
          p.name AS "projectName",
          arch.url AS url,
          n."updatedAt" AS "updatedAt",
          n."createdAt" AS "createdAt",
          NULLIF(BTRIM(CONCAT(e."firstName", ' ', e."lastName")), '') AS "creatorName",
          NULL::text AS "sourceType",
          NULL::text AS "folderPath",
          NULL::text AS "docType",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "OpsDeliveryNote" n
        LEFT JOIN "Project" p ON p.id = n."projectId"
        LEFT JOIN "Employee" e ON e.id = n."foremanId"
        LEFT JOIN archive arch
          ON arch."sourceType" = 'delivery_note' AND arch."sourceId" = n.id
        WHERE n."deletedAt" IS NULL
          AND n."projectId" IS NOT NULL
          AND EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR n."projectId" = ${projectId})
      ),
      sheets AS (
        SELECT
          'measurement_sheet'::text AS kind,
          s.id AS "entityId",
          arch.id AS "documentId",
          NULL::text AS "workflowDocumentId",
          s.title AS title,
          NULL::text AS "documentNumber",
          s."sequenceNumber" AS "sequenceNumber",
          s.status::text AS status,
          NULL::text AS "legacyStatus",
          s."projectId" AS "projectId",
          p.name AS "projectName",
          arch.url AS url,
          s."updatedAt" AS "updatedAt",
          s."createdAt" AS "createdAt",
          u.name AS "creatorName",
          NULL::text AS "sourceType",
          NULL::text AS "folderPath",
          NULL::text AS "docType",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "MeasurementSheet" s
        LEFT JOIN "Project" p ON p.id = s."projectId"
        LEFT JOIN "User" u ON u.id = s."createdById"
        LEFT JOIN archive arch
          ON arch."sourceType" = 'measurement_sheet' AND arch."sourceId" = s.id
        WHERE EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR s."projectId" = ${projectId})
      ),
      invoices AS (
        SELECT
          'invoice'::text AS kind,
          inv.id AS "entityId",
          COALESCE(arch_pi.id, arch_inv.id) AS "documentId",
          NULL::text AS "workflowDocumentId",
          NULL::text AS title,
          inv."invoiceNumber" AS "documentNumber",
          NULL::int AS "sequenceNumber",
          inv.status::text AS status,
          NULL::text AS "legacyStatus",
          inv."projectId" AS "projectId",
          p.name AS "projectName",
          COALESCE(arch_pi.url, arch_inv.url) AS url,
          inv."updatedAt" AS "updatedAt",
          inv."createdAt" AS "createdAt",
          NULL::text AS "creatorName",
          NULL::text AS "sourceType",
          NULL::text AS "folderPath",
          NULL::text AS "docType",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "PartialInvoice" inv
        LEFT JOIN "Project" p ON p.id = inv."projectId"
        LEFT JOIN archive arch_pi
          ON arch_pi."sourceType" = 'partial_invoice' AND arch_pi."sourceId" = inv.id
        LEFT JOIN archive arch_inv
          ON arch_inv."sourceType" = 'invoice' AND arch_inv."sourceId" = inv.id
        WHERE EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR inv."projectId" = ${projectId})
      ),
      files AS (
        SELECT
          'file'::text AS kind,
          doc.id AS "entityId",
          doc.id AS "documentId",
          doc."workflowDocumentId" AS "workflowDocumentId",
          doc.name AS title,
          NULL::text AS "documentNumber",
          NULL::int AS "sequenceNumber",
          NULL::text AS status,
          NULL::text AS "legacyStatus",
          doc."projectId" AS "projectId",
          p.name AS "projectName",
          doc.url AS url,
          doc."updatedAt" AS "updatedAt",
          doc."createdAt" AS "createdAt",
          up.name AS "creatorName",
          doc."sourceType" AS "sourceType",
          doc."folderPath" AS "folderPath",
          doc.type::text AS "docType",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "Document" doc
        LEFT JOIN "Project" p ON p.id = doc."projectId"
        LEFT JOIN "User" up ON up.id = doc."uploadedById"
        WHERE EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR doc."projectId" = ${projectId})
          AND (
            doc."sourceType" IS NULL
            OR doc."sourceType" NOT IN (
              'work_diary',
              'delivery_note',
              'measurement_sheet',
              'partial_invoice',
              'invoice'
            )
            OR doc."sourceType" LIKE '%\_signed' ESCAPE '\'
          )
      ),
      auth_probe AS (
        SELECT
          'auth_probe'::text AS kind,
          NULL::text AS "entityId",
          NULL::text AS "documentId",
          NULL::text AS "workflowDocumentId",
          NULL::text AS title,
          NULL::text AS "documentNumber",
          NULL::int AS "sequenceNumber",
          NULL::text AS status,
          NULL::text AS "legacyStatus",
          NULL::text AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS url,
          NULL::timestamptz AS "updatedAt",
          NULL::timestamptz AS "createdAt",
          NULL::text AS "creatorName",
          NULL::text AS "sourceType",
          NULL::text AS "folderPath",
          NULL::text AS "docType",
          auth.user_id AS "authUserId"
        FROM auth
      ),
      unioned AS (
        SELECT * FROM auth_probe
        UNION ALL SELECT * FROM diaries
        UNION ALL SELECT * FROM notes
        UNION ALL SELECT * FROM sheets
        UNION ALL SELECT * FROM invoices
        UNION ALL SELECT * FROM files
      ),
      enriched AS (
        SELECT
          u.*,
          CASE
            WHEN u.kind = 'auth_probe' THEN NULL
            WHEN u."sourceType" LIKE '%\_signed' ESCAPE '\'
              OR u.status IN ('client_signed', 'signed')
              OR u."folderPath" ILIKE '%חתומ%'
              THEN 'signed'
            WHEN u.status IN ('revision', 'revision_requested') THEN 'revision'
            WHEN u.status IN ('draft', 'in_progress') THEN 'draft'
            WHEN u.kind = 'work_diary'
              OR u."sourceType" = 'work_diary'
              OR u."folderPath" LIKE 'יומני עבודה%'
              THEN 'work_diary'
            WHEN u.kind = 'measurement_sheet'
              OR u."sourceType" LIKE '%measurement%'
              OR u."folderPath" LIKE 'דוחות ביצוע%'
              OR u."folderPath" LIKE 'דפי מדידה%'
              OR u."folderPath" LIKE 'מדידות%'
              THEN 'measurement'
            WHEN u.kind = 'delivery_note'
              OR u."sourceType" LIKE '%delivery%'
              OR u."folderPath" LIKE 'תעודות משלוח%'
              THEN 'delivery'
            WHEN u.kind = 'invoice'
              OR u."sourceType" LIKE '%invoice%'
              OR u."sourceType" LIKE '%account%'
              OR u."folderPath" LIKE 'חשבונות%'
              OR u."folderPath" LIKE 'חשבון%'
              THEN 'invoice'
            WHEN u.kind = 'change_order'
              OR u."sourceType" LIKE '%change%'
              OR u."folderPath" LIKE '%שינו%'
              THEN 'change'
            WHEN u."docType" IN ('image', 'video')
              OR u."folderPath" LIKE 'תמונות%'
              OR u."folderPath" LIKE 'סרטונים%'
              THEN 'files'
            ELSE 'files'
          END AS "hubFolder"
        FROM unioned u
      ),
      q_filtered AS (
        SELECT * FROM enriched
        WHERE kind <> 'auth_probe'
          AND (
            ${qLike}::text IS NULL
            OR "documentNumber" ILIKE ${qLike}
            OR title ILIKE ${qLike}
            OR "projectName" ILIKE ${qLike}
            OR "creatorName" ILIKE ${qLike}
            OR (
              kind = 'work_diary'
              AND ('יומן עבודה ' || COALESCE("documentNumber", '')) ILIKE ${qLike}
            )
            OR (
              kind = 'delivery_note'
              AND ('תעודת משלוח ' || COALESCE("documentNumber", '')) ILIKE ${qLike}
            )
            OR (
              kind = 'measurement_sheet'
              AND ('דף מדידה MS-' || COALESCE("sequenceNumber"::text, '0')) ILIKE ${qLike}
            )
            OR (
              kind = 'invoice'
              AND ('חשבון ' || COALESCE("documentNumber", '')) ILIKE ${qLike}
            )
          )
      ),
      folder_counts AS (
        SELECT "hubFolder", COUNT(*)::bigint AS cnt
        FROM q_filtered
        GROUP BY "hubFolder"
      ),
      filtered AS (
        SELECT * FROM q_filtered
        WHERE ${folderIdParam}::text IS NULL
          OR "hubFolder" = ${folderIdParam}::text
      ),
      totals AS (
        SELECT COUNT(*)::bigint AS total FROM filtered
      ),
      page_data AS (
        SELECT * FROM filtered
        ORDER BY "updatedAt" DESC NULLS LAST, "entityId" ASC
        LIMIT ${take + 1} OFFSET ${skip}
      ),
      page AS (
        SELECT * FROM enriched WHERE kind = 'auth_probe'
        UNION ALL
        SELECT * FROM page_data
      )
      SELECT
        p.kind,
        p."entityId",
        p."documentId",
        p."workflowDocumentId",
        p.title,
        p."documentNumber",
        p."sequenceNumber",
        p.status,
        p."legacyStatus",
        p."projectId",
        p."projectName",
        p.url,
        p."updatedAt",
        p."createdAt",
        p."creatorName",
        p."sourceType",
        p."folderPath",
        p."docType",
        p."authUserId",
        p."hubFolder",
        t.total AS "_total"
      FROM page p CROSS JOIN totals t
      UNION ALL
      SELECT
        '__folder_count__'::text AS kind,
        fc."hubFolder" AS "entityId",
        NULL::text AS "documentId",
        NULL::text AS "workflowDocumentId",
        NULL::text AS title,
        NULL::text AS "documentNumber",
        fc.cnt::int AS "sequenceNumber",
        NULL::text AS status,
        NULL::text AS "legacyStatus",
        NULL::text AS "projectId",
        NULL::text AS "projectName",
        NULL::text AS url,
        NULL::timestamptz AS "updatedAt",
        NULL::timestamptz AS "createdAt",
        NULL::text AS "creatorName",
        NULL::text AS "sourceType",
        NULL::text AS "folderPath",
        NULL::text AS "docType",
        NULL::text AS "authUserId",
        NULL::text AS "hubFolder",
        NULL::bigint AS "_total"
      FROM folder_counts fc
    `;

    const authUserId =
      rows.find((r) => r.kind === "auth_probe")?.authUserId ??
      rows.find((r) => r.authUserId)?.authUserId ??
      null;
    if (!authUserId) return { status: "forbidden" };

    const folderCounts: Record<string, number> = {};
    let hasFolderCounts = false;
    let total = 0;
    let sawTotal = false;
    const items: HubListItem[] = [];

    for (const row of rows) {
      if (row.kind === "__folder_count__") {
        if (row.entityId && row.sequenceNumber != null) {
          folderCounts[row.entityId] = Number(row.sequenceNumber);
          hasFolderCounts = true;
        }
        continue;
      }
      if (row.kind === "auth_probe" || !row.entityId || !row.projectId) continue;
      if (!sawTotal && row._total != null) {
        total = Number(row._total);
        sawTotal = true;
      }

      if (row.kind === "work_diary") {
        const status = (row.status || row.legacyStatus || "draft") as string;
        const ui = statusUi(status);
        const archId = row.documentId;
        items.push({
          hubKey: hubKey("work_diary", row.entityId),
          kind: "work_diary",
          entityId: row.entityId,
          documentId: archId ?? null,
          workflowDocumentId: row.workflowDocumentId,
          title: `יומן עבודה ${row.documentNumber}`,
          documentNumber: row.documentNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          folderId: resolveHubFolder({ kind: "work_diary", status }),
          projectId: row.projectId,
          projectName: row.projectName ?? null,
          inArchive: !!archId,
          url: row.url || `/print/work-diaries/${row.entityId}`,
          updatedAt: row.updatedAt!.toISOString(),
          createdAt: row.createdAt!.toISOString(),
          creatorName: row.creatorName ?? null,
        });
        continue;
      }

      if (row.kind === "delivery_note") {
        const status = (row.status || "draft") as string;
        const ui = statusUi(status);
        const archId = row.documentId;
        items.push({
          hubKey: hubKey("delivery_note", row.entityId),
          kind: "delivery_note",
          entityId: row.entityId,
          documentId: archId ?? null,
          workflowDocumentId: null,
          title: `תעודת משלוח ${row.documentNumber}`,
          documentNumber: row.documentNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          folderId: resolveHubFolder({ kind: "delivery_note", status }),
          projectId: row.projectId,
          projectName: row.projectName ?? null,
          inArchive: !!archId,
          url: row.url || null,
          updatedAt: row.updatedAt!.toISOString(),
          createdAt: row.createdAt!.toISOString(),
          creatorName: row.creatorName ?? null,
        });
        continue;
      }

      if (row.kind === "measurement_sheet") {
        const status = (row.status || "draft") as string;
        const ui = statusUi(status);
        const archId = row.documentId;
        const num = `MS-${row.sequenceNumber ?? 0}`;
        items.push({
          hubKey: hubKey("measurement_sheet", row.entityId),
          kind: "measurement_sheet",
          entityId: row.entityId,
          documentId: archId ?? null,
          workflowDocumentId: null,
          title: row.title || `דף מדידה ${num}`,
          documentNumber: num,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          folderId: resolveHubFolder({ kind: "measurement_sheet", status }),
          projectId: row.projectId,
          projectName: row.projectName ?? null,
          inArchive: !!archId,
          url: row.url || `/print/measurement-sheets/${row.entityId}`,
          updatedAt: row.updatedAt!.toISOString(),
          createdAt: row.createdAt!.toISOString(),
          creatorName: row.creatorName ?? null,
        });
        continue;
      }

      if (row.kind === "invoice") {
        const status = (row.status || "draft") as string;
        const ui = statusUi(status === "approved" ? "approved" : status);
        const archId = row.documentId;
        items.push({
          hubKey: hubKey("invoice", row.entityId),
          kind: "invoice",
          entityId: row.entityId,
          documentId: archId ?? null,
          workflowDocumentId: null,
          title: `חשבון ${row.documentNumber}`,
          documentNumber: row.documentNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          folderId: resolveHubFolder({ kind: "invoice", status }),
          projectId: row.projectId,
          projectName: row.projectName ?? null,
          inArchive: !!archId,
          url: row.url || null,
          updatedAt: row.updatedAt!.toISOString(),
          createdAt: row.createdAt!.toISOString(),
          creatorName: null,
        });
        continue;
      }

      if (row.kind === "file") {
        const st = row.sourceType || "file";
        const kind: HubDocKind = st.endsWith("_signed") ? "signed" : "file";
        const status = st.endsWith("_signed") ? "client_signed" : "approved";
        const ui = statusUi(status);
        items.push({
          hubKey: hubKey("file", row.entityId),
          kind,
          entityId: row.entityId,
          documentId: row.entityId,
          workflowDocumentId: row.workflowDocumentId,
          title: row.title || "",
          documentNumber: null,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          folderId: resolveHubFolder({
            kind,
            status,
            sourceType: row.sourceType,
            folderPath: row.folderPath,
            type: row.docType,
          }),
          projectId: row.projectId,
          projectName: row.projectName ?? null,
          inArchive: true,
          url: row.url,
          updatedAt: row.updatedAt!.toISOString(),
          createdAt: row.createdAt!.toISOString(),
          creatorName: row.creatorName ?? null,
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.entityId.localeCompare(b.entityId)
    );

    const fetchedCount = items.length;
    const hasMore = fetchedCount > take;
    if (hasMore) items.length = take;

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeTimeIdCursor(last.updatedAt, last.entityId) : null;

    const pageInfo = buildPageInfo({
      take,
      skip,
      page: take > 0 ? Math.floor(skip / take) + 1 : 1,
      fetchedCount,
      returnedCount: items.length,
      total,
      nextCursor,
    });

    return {
      status: "ok",
      items,
      pageInfo,
      folderCounts: hasFolderCounts ? folderCounts : undefined,
    };
  }

  /**
   * Documents archive page: office auth + work diaries + delivery notes in 1 RTT.
   * Same item shape as GET /api/documents-archive.
   */
  static async listArchiveForOffice(
    officeUserId: string,
    filters: {
      kind?: string | null;
      documentNumber?: string;
      projectId?: string;
      clientName?: string;
      status?: string;
      take?: number;
    }
  ): Promise<DocumentsArchiveListResult> {
    const take = filters.take ?? 100;
    const kind = filters.kind ?? null;
    const includeDiaries = !kind || kind === "all" || kind === "work_diary";
    const includeNotes =
      !kind || kind === "all" || kind === "delivery_note";
    const projectId = filters.projectId ?? null;
    const documentNumber = filters.documentNumber?.trim() || null;
    const clientName = filters.clientName?.trim() || null;
    const status = filters.status || null;

    const rows = await prisma.$queryRaw<ArchiveSqlRow[]>`
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
      diaries AS (
        SELECT
          'work_diary'::text AS kind,
          d.id,
          d."documentNumber" AS "documentNumber",
          COALESCE(wd.status::text, d.status::text) AS status,
          d.status::text AS "legacyStatus",
          d."workflowDocumentId" AS "workflowDocumentId",
          d."workDate" AS "workDate",
          d."clientName" AS "clientName",
          p.id AS "projectId",
          p.name AS "projectName",
          e.id AS "foremanId",
          NULLIF(BTRIM(CONCAT(e."firstName", ' ', e."lastName")), '') AS "foremanName",
          appr.name AS "approverName",
          d."clientSignedAt" AS "clientSignedAt",
          d."createdAt" AS "createdAt",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "WorkDiary" d
        LEFT JOIN "WorkflowDocument" wd ON wd.id = d."workflowDocumentId"
        LEFT JOIN "Project" p ON p.id = d."projectId"
        LEFT JOIN "Employee" e ON e.id = d."foremanId"
        LEFT JOIN LATERAL (
          SELECT u.name
          FROM "WorkflowApproval" wa
          INNER JOIN "User" u ON u.id = wa."approverId"
          WHERE wa."documentId" = wd.id
            AND wa.status = 'approved'
          ORDER BY wa."decidedAt" DESC NULLS LAST
          LIMIT 1
        ) appr ON true
        WHERE ${includeDiaries}::boolean = true
          AND d."deletedAt" IS NULL
          AND EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR d."projectId" = ${projectId})
          AND (
            ${documentNumber}::text IS NULL
            OR d."documentNumber" ILIKE '%' || ${documentNumber} || '%'
          )
          AND (
            ${clientName}::text IS NULL
            OR d."clientName" ILIKE '%' || ${clientName} || '%'
          )
          AND (
            ${status}::text IS NULL
            OR wd.status::text = ${status}
          )
        ORDER BY d."createdAt" DESC
        LIMIT ${take}
      ),
      notes AS (
        SELECT
          'delivery_note'::text AS kind,
          n.id,
          n."documentNumber" AS "documentNumber",
          n.status::text AS status,
          NULL::text AS "legacyStatus",
          NULL::text AS "workflowDocumentId",
          n."noteDate" AS "workDate",
          n."clientName" AS "clientName",
          p.id AS "projectId",
          p.name AS "projectName",
          e.id AS "foremanId",
          NULLIF(BTRIM(CONCAT(e."firstName", ' ', e."lastName")), '') AS "foremanName",
          NULL::text AS "approverName",
          NULL::timestamptz AS "clientSignedAt",
          n."createdAt" AS "createdAt",
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
        FROM "OpsDeliveryNote" n
        LEFT JOIN "Project" p ON p.id = n."projectId"
        LEFT JOIN "Employee" e ON e.id = n."foremanId"
        WHERE ${includeNotes}::boolean = true
          AND n."deletedAt" IS NULL
          AND EXISTS (SELECT 1 FROM auth)
          AND (${projectId}::text IS NULL OR n."projectId" = ${projectId})
          AND (
            ${status}::text IS NULL
            OR n.status::text = ${status}
          )
        ORDER BY n."createdAt" DESC
        LIMIT ${take}
      ),
      auth_probe AS (
        SELECT
          'auth_probe'::text AS kind,
          NULL::text AS id,
          NULL::text AS "documentNumber",
          NULL::text AS status,
          NULL::text AS "legacyStatus",
          NULL::text AS "workflowDocumentId",
          NULL::date AS "workDate",
          NULL::text AS "clientName",
          NULL::text AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS "foremanId",
          NULL::text AS "foremanName",
          NULL::text AS "approverName",
          NULL::timestamptz AS "clientSignedAt",
          NULL::timestamptz AS "createdAt",
          auth.user_id AS "authUserId"
        FROM auth
      )
      SELECT * FROM auth_probe
      UNION ALL
      SELECT * FROM diaries
      UNION ALL
      SELECT * FROM notes
    `;

    const authUserId =
      rows.find((r) => r.kind === "auth_probe")?.authUserId ??
      rows[0]?.authUserId ??
      null;
    if (!authUserId) return { status: "forbidden" };

    const items: DocumentsArchiveListItem[] = [];

    for (const row of rows) {
      if (row.kind === "auth_probe" || !row.id) continue;

      if (row.kind === "work_diary") {
        const status: WorkflowStatus = row.workflowDocumentId
          ? ((row.status || "draft") as WorkflowStatus)
          : mapLegacyDiaryStatusToWorkflow(
              String(row.legacyStatus ?? row.status ?? "draft")
            );
        items.push({
          id: row.id,
          kind: "work_diary",
          documentNumber: row.documentNumber ?? "",
          status,
          statusLabel: WORKFLOW_STATUS_LABELS[status] ?? status,
          workflowDocumentId: row.workflowDocumentId,
          workDate: isoDate(row.workDate),
          clientName: row.clientName,
          project: row.projectId
            ? { id: row.projectId, name: row.projectName ?? "" }
            : null,
          foreman: row.foremanId
            ? { id: row.foremanId, name: row.foremanName ?? "" }
            : null,
          approverName: row.approverName,
          clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
          createdAt: row.createdAt!.toISOString(),
        });
        continue;
      }

      if (row.kind === "delivery_note") {
        // Preserve prior route behavior: documentNumber/clientName filtered after take.
        if (
          documentNumber &&
          !(row.documentNumber ?? "")
            .toLowerCase()
            .includes(documentNumber.toLowerCase())
        ) {
          continue;
        }
        if (
          clientName &&
          !(row.clientName ?? "")
            .toLowerCase()
            .includes(clientName.toLowerCase())
        ) {
          continue;
        }
        items.push({
          id: row.id,
          kind: "delivery_note",
          documentNumber: row.documentNumber ?? "",
          status: row.status ?? "draft",
          workDate: isoDate(row.workDate),
          clientName: row.clientName,
          project:
            row.projectId != null
              ? { id: row.projectId, name: row.projectName ?? "" }
              : null,
          foreman: row.foremanId
            ? { id: row.foremanId, name: row.foremanName ?? "" }
            : null,
          approverName: null,
          clientSignedAt: null,
          createdAt: row.createdAt!.toISOString(),
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { status: "ok", items };
  }

  static async getDetail(kind: string, entityId: string) {
    if (kind === "file" || kind === "document") {
      const doc = await DocumentsRepository.findById(entityId);
      if (!doc) return null;
      const raw = await prisma.document.findUnique({
        where: { id: entityId },
        select: { workflowDocumentId: true },
      });
      const workflowDocumentId = raw?.workflowDocumentId ?? null;
      let timeline: any[] = [];
      let conversation: any[] = [];
      let approvals: any[] = [];
      let versions: any[] = doc.versions || [];
      if (workflowDocumentId) {
        timeline = await WorkflowRepository.timeline(workflowDocumentId);
        conversation =
          await WorkflowRepository.listConversation(workflowDocumentId);
        const wf = await WorkflowRepository.getById(workflowDocumentId);
        approvals = (wf as any)?.approvals || [];
      }
      const related = await this.loadRelated(doc.projectId);
      return {
        kind: "file",
        entityId,
        list: {
          hubKey: hubKey("file", entityId),
          kind: "file" as const,
          title: doc.name,
          status: "approved",
          ...statusUi("approved"),
          inArchive: true,
          documentId: doc.id,
          url: doc.url,
          projectId: doc.projectId,
        },
        document: doc,
        approvals: this.mapApprovals(approvals),
        requests: this.mapRequests(timeline),
        revisions: this.mapRevisions(timeline),
        versions,
        related,
        shares: [],
        signatures: [],
        timeline,
        conversation,
        workflowDocumentId,
      };
    }

    if (kind === "work_diary") {
      const diary = await prisma.workDiary.findFirst({
        where: { id: entityId, deletedAt: null },
        include: {
          project: { select: { id: true, name: true, contractor: true } },
          foreman: { select: { firstName: true, lastName: true } },
          workflowDocument: {
            include: {
              approvals: {
                include: { approver: { select: { id: true, name: true, role: true } } },
                orderBy: { sentAt: "desc" },
              },
              events: {
                include: { actor: { select: { name: true } } },
                orderBy: { createdAt: "asc" },
              },
              versions: { orderBy: { version: "desc" } },
            },
          },
        },
      });
      if (!diary) return null;

      const status = (diary.workflowDocument?.status || diary.status) as string;
      const ui = statusUi(status);
      const arch = await prisma.document.findFirst({
        where: {
          OR: [
            { workflowDocumentId: diary.workflowDocumentId ?? undefined },
            { sourceType: "work_diary", sourceId: diary.id },
          ],
        },
      });
      const timeline = (diary.workflowDocument?.events || []).map((e) => ({
        id: e.id,
        action: e.type,
        message: e.message,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        createdAt: e.createdAt.toISOString(),
        actorName: e.actor?.name ?? null,
      }));
      const conversation = diary.workflowDocumentId
        ? await WorkflowRepository.listConversation(diary.workflowDocumentId)
        : [];
      const shares = await prisma.workDiarySignToken.findMany({
        where: { workDiaryId: diary.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const related = await this.loadRelated(diary.projectId);

      return {
        kind: "work_diary",
        entityId,
        list: {
          hubKey: hubKey("work_diary", diary.id),
          kind: "work_diary" as const,
          title: `יומן עבודה ${diary.documentNumber}`,
          documentNumber: diary.documentNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          inArchive: !!arch,
          documentId: arch?.id ?? null,
          url: arch?.url || `/print/work-diaries/${diary.id}`,
          projectId: diary.projectId,
          projectName: diary.project?.name,
          creatorName: diary.foreman
            ? `${diary.foreman.firstName} ${diary.foreman.lastName}`
            : null,
        },
        document: arch ? await DocumentsRepository.findById(arch.id) : null,
        entity: {
          workDate: diary.workDate.toISOString().slice(0, 10),
          clientName: diary.clientName,
          workSummary: diary.workSummary,
          notes: diary.notes,
        },
        approvals: this.mapApprovals(
          diary.workflowDocument?.approvals || []
        ),
        requests: this.mapRequests(timeline),
        revisions: this.mapRevisions(timeline),
        versions: (diary.workflowDocument?.versions || []).map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          note: v.note,
          createdAt: v.createdAt.toISOString(),
          url: `/print/work-diaries/${diary.id}`,
        })),
        related,
        shares: shares.map((t) => ({
          id: t.id,
          status: t.usedAt
            ? "signed"
            : t.revokedAt
              ? "revoked"
              : t.expiresAt && t.expiresAt < new Date()
                ? "expired"
                : "active",
          createdAt: t.createdAt.toISOString(),
          expiresAt: t.expiresAt?.toISOString() ?? null,
          usedAt: t.usedAt?.toISOString() ?? null,
          url: `/sign/work-diary/${t.publicId}`,
        })),
        signatures: [
          diary.foremanSignatureUrl
            ? {
                role: "foreman",
                name: diary.foremanSignedName,
                at: diary.foremanSignedAt?.toISOString() ?? null,
                url: diary.foremanSignatureUrl,
              }
            : null,
          diary.clientSignatureUrl
            ? {
                role: "client",
                name: diary.clientSignedName,
                at: diary.clientSignedAt?.toISOString() ?? null,
                url: diary.clientSignatureUrl,
              }
            : null,
        ].filter(Boolean),
        timeline,
        conversation,
        workflowDocumentId: diary.workflowDocumentId,
      };
    }

    if (kind === "delivery_note") {
      const note = await prisma.opsDeliveryNote.findFirst({
        where: { id: entityId, deletedAt: null },
        include: {
          project: { select: { id: true, name: true } },
          foreman: { select: { firstName: true, lastName: true } },
          approvals: {
            include: { approver: { select: { id: true, name: true, role: true } } },
            orderBy: { sentAt: "desc" },
          },
          events: {
            include: { actor: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!note) return null;
      const status = note.status as string;
      const ui = statusUi(status);
      const arch = await prisma.document.findFirst({
        where: { sourceType: "delivery_note", sourceId: note.id },
      });
      const timeline = (note.events || []).map((e) => ({
        id: e.id,
        action: e.action,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        actorName: e.actor?.name ?? null,
      }));
      const shares = await prisma.opsDeliveryNoteSignToken.findMany({
        where: { opsDeliveryNoteId: note.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      if (!note.projectId) return null;
      const related = await this.loadRelated(note.projectId);

      return {
        kind: "delivery_note",
        entityId,
        list: {
          hubKey: hubKey("delivery_note", note.id),
          kind: "delivery_note" as const,
          title: `תעודת משלוח ${note.documentNumber}`,
          documentNumber: note.documentNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          inArchive: !!arch,
          documentId: arch?.id ?? null,
          url: arch?.url ?? null,
          projectId: note.projectId,
          projectName: note.project?.name,
          creatorName: note.foreman
            ? `${note.foreman.firstName} ${note.foreman.lastName}`
            : null,
        },
        document: arch ? await DocumentsRepository.findById(arch.id) : null,
        entity: { noteDate: note.noteDate.toISOString().slice(0, 10), notes: note.notes },
        approvals: this.mapApprovals(note.approvals),
        requests: this.mapRequests(timeline),
        revisions: this.mapRevisions(timeline),
        versions: [],
        related,
        shares: shares.map((t) => ({
          id: t.id,
          status: t.usedAt
            ? "signed"
            : t.revokedAt
              ? "revoked"
              : t.expiresAt && t.expiresAt < new Date()
                ? "expired"
                : "active",
          createdAt: t.createdAt.toISOString(),
          expiresAt: t.expiresAt?.toISOString() ?? null,
          usedAt: t.usedAt?.toISOString() ?? null,
          url: `/sign/delivery-note/${t.publicId}`,
        })),
        signatures: [
          note.clientSignatureUrl
            ? {
                role: "client",
                name: note.clientSignedName,
                at: note.clientSignedAt?.toISOString() ?? null,
                url: note.clientSignatureUrl,
              }
            : null,
        ].filter(Boolean),
        timeline,
        conversation: [],
        workflowDocumentId: null,
      };
    }

    if (kind === "measurement_sheet") {
      const sheet = await prisma.measurementSheet.findUnique({
        where: { id: entityId },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          approvals: {
            include: { approver: { select: { id: true, name: true, role: true } } },
            orderBy: { sentAt: "desc" },
          },
          events: {
            include: { actor: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          versions: { orderBy: { version: "desc" } },
        },
      });
      if (!sheet) return null;
      const status = sheet.status as string;
      const ui = statusUi(status);
      const arch = await prisma.document.findFirst({
        where: { sourceType: "measurement_sheet", sourceId: sheet.id },
      });
      const timeline = (sheet.events || []).map((e) => ({
        id: e.id,
        action: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        actorName: e.actor?.name ?? null,
      }));
      const shares = await prisma.measurementSheetSignToken.findMany({
        where: { sheetId: sheet.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const related = await this.loadRelated(sheet.projectId);
      const num = `MS-${sheet.sequenceNumber}`;

      return {
        kind: "measurement_sheet",
        entityId,
        list: {
          hubKey: hubKey("measurement_sheet", sheet.id),
          kind: "measurement_sheet" as const,
          title: sheet.title || `דף מדידה ${num}`,
          documentNumber: num,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          inArchive: !!arch,
          documentId: arch?.id ?? null,
          url: arch?.url || `/print/measurement-sheets/${sheet.id}`,
          projectId: sheet.projectId,
          projectName: sheet.project?.name,
          creatorName: sheet.createdBy?.name ?? null,
        },
        document: arch ? await DocumentsRepository.findById(arch.id) : null,
        entity: {
          lastReturnComment: sheet.lastReturnComment,
          currentVersion: sheet.currentVersion,
        },
        approvals: this.mapApprovals(sheet.approvals),
        requests: this.mapRequests(timeline),
        revisions: this.mapRevisions(timeline, sheet.lastReturnComment),
        versions: (sheet.versions || []).map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          note: v.note,
          createdAt: v.createdAt.toISOString(),
          url: `/print/measurement-sheets/${sheet.id}`,
        })),
        related,
        shares: shares.map((t) => ({
          id: t.id,
          status: t.usedAt
            ? "signed"
            : t.revokedAt
              ? "revoked"
              : t.expiresAt && t.expiresAt < new Date()
                ? "expired"
                : "active",
          createdAt: t.createdAt.toISOString(),
          expiresAt: t.expiresAt?.toISOString() ?? null,
          usedAt: t.usedAt?.toISOString() ?? null,
          url: `/sign/measurement/${t.publicId}`,
        })),
        signatures: [],
        timeline,
        conversation: [],
        workflowDocumentId: null,
      };
    }

    if (kind === "invoice") {
      const inv = await prisma.partialInvoice.findUnique({
        where: { id: entityId },
        include: {
          project: { select: { id: true, name: true } },
        },
      });
      if (!inv) return null;
      const status = inv.status as string;
      const ui = statusUi(status === "approved" ? "approved" : status);
      const arch =
        (await prisma.document.findFirst({
          where: {
            OR: [
              { partialInvoiceId: inv.id },
              { sourceType: "partial_invoice", sourceId: inv.id },
            ],
          },
        })) || null;
      const related = await this.loadRelated(inv.projectId);

      return {
        kind: "invoice",
        entityId,
        list: {
          hubKey: hubKey("invoice", inv.id),
          kind: "invoice" as const,
          title: `חשבון ${inv.invoiceNumber}`,
          documentNumber: inv.invoiceNumber,
          status,
          statusLabel: ui.label,
          statusTone: ui.tone,
          inArchive: !!arch,
          documentId: arch?.id ?? null,
          url: arch?.url ?? null,
          projectId: inv.projectId,
          projectName: inv.project?.name,
          creatorName: null,
        },
        document: arch ? await DocumentsRepository.findById(arch.id) : null,
        entity: { amount: Number(inv.amount), notes: inv.notes },
        approvals: [],
        requests: [],
        revisions: [],
        versions: [],
        related,
        shares: [],
        signatures: [],
        timeline: [],
        conversation: [],
        workflowDocumentId: null,
      };
    }

    return null;
  }

  static async ensureInArchive(input: {
    kind: string;
    entityId: string;
    userId: string;
    baseUrl?: string;
  }) {
    if (input.kind === "work_diary") {
      const diary = await prisma.workDiary.findFirst({
        where: { id: input.entityId, deletedAt: null },
        include: { workflowDocument: true },
      });
      if (!diary) throw new Error("יומן לא נמצא");
      if (!diary.workflowDocumentId) {
        throw new Error("ליומן אין מסמך Workflow — לא ניתן לארכב");
      }
      const status = mapLegacyDiaryStatusToWorkflow(
        diary.workflowDocument?.status || diary.status
      );
      const doc = await syncWorkDiaryArchiveDocument({
        workflowDocumentId: diary.workflowDocumentId,
        workDiaryId: diary.id,
        projectId: diary.projectId,
        documentNumber: diary.documentNumber,
        title: diary.workflowDocument?.title,
        status,
        userId: input.userId,
        printBaseUrl: input.baseUrl,
      });
      return { documentId: doc.id, created: true };
    }

    if (input.kind === "measurement_sheet") {
      const sheet = await prisma.measurementSheet.findUnique({
        where: { id: input.entityId },
      });
      if (!sheet) throw new Error("דף מדידה לא נמצא");
      const result = await MeasurementSheetsRepository.ensureDocument(
        input.entityId,
        input.userId,
        sheet.status,
        input.baseUrl
      );
      return { documentId: result.id, created: true };
    }

    if (input.kind === "delivery_note") {
      const note = await prisma.opsDeliveryNote.findFirst({
        where: { id: input.entityId, deletedAt: null },
      });
      if (!note) throw new Error("תעודה לא נמצאה");
      if (!note.projectId) throw new Error("לתעודה אין פרויקט — לא ניתן לארכב");
      const existing = await prisma.document.findFirst({
        where: { sourceType: "delivery_note", sourceId: note.id },
      });
      if (existing) return { documentId: existing.id, created: false };

      const folderPath =
        note.status === "revision"
          ? "תעודות משלוח/דורש תיקון"
          : note.status === "draft"
            ? "תעודות משלוח/טיוטות"
            : note.status === "approved" || note.status === "signed"
              ? "תעודות משלוח/מאושרים"
              : "תעודות משלוח/ממתין לאישור";

      const path = `ops-delivery-notes/${note.id}`;
      const url = input.baseUrl
        ? `${input.baseUrl.replace(/\/$/, "")}/field/delivery-notes/${note.id}`
        : `/field/delivery-notes/${note.id}`;

      const doc = await prisma.document.create({
        data: {
          projectId: note.projectId,
          name: `תעודת משלוח ${note.documentNumber}.pdf`,
          type: "pdf",
          extension: "pdf",
          size: 0,
          bucket: "documents",
          path,
          url,
          folderPath,
          sourceType: "delivery_note",
          sourceId: note.id,
          uploadedById: input.userId,
          ownerId: input.userId,
          createdById: input.userId,
          updatedById: input.userId,
          versions: {
            create: {
              version: 1,
              size: 0,
              bucket: "documents",
              path,
              url,
              uploadedById: input.userId,
            },
          },
        },
      });
      return { documentId: doc.id, created: true };
    }

    if (input.kind === "invoice") {
      const { InvoiceApprovalsRepository } = await import(
        "@/repositories/invoice-approvals.repository"
      );
      const saved = await InvoiceApprovalsRepository.saveInvoiceDocument(
        input.entityId,
        input.userId,
        input.baseUrl
      );
      return {
        documentId: saved.document.id,
        created: saved.created,
      };
    }

    if (input.kind === "file" || input.kind === "document") {
      return { documentId: input.entityId, created: false };
    }

    throw new Error("סוג מסמך לא נתמך להוספה לארכיון");
  }

  private static mapApprovals(rows: any[]) {
    return rows.map((a) => {
      const name = a.approver?.name || a.approverName || "מאשר";
      const role = a.approver?.role || "";
      let label = "ממתין";
      let icon: "ok" | "wait" | "reject" | "cancel" = "wait";
      if (a.status === "approved") {
        label = "אישר";
        icon = "ok";
      } else if (a.status === "rejected") {
        label = "החזיר לתיקון";
        icon = "reject";
      } else if (a.status === "cancelled") {
        label = "בוטל";
        icon = "cancel";
      }
      return {
        id: a.id,
        name,
        role,
        status: a.status,
        label,
        icon,
        comment: a.comment ?? null,
        sentAt: a.sentAt?.toISOString?.() ?? a.sentAt ?? null,
        decidedAt: a.decidedAt?.toISOString?.() ?? a.decidedAt ?? null,
      };
    });
  }

  private static mapRequests(timeline: any[]) {
    return timeline.map((t) => ({
      id: t.id,
      action: t.action || t.type,
      message: t.message,
      createdAt: t.createdAt,
      actorName: t.actorName ?? null,
      fromStatus: t.fromStatus ?? null,
      toStatus: t.toStatus ?? null,
    }));
  }

  private static mapRevisions(timeline: any[], lastComment?: string | null) {
    const revs = timeline.filter((t) => {
      const a = String(t.action || t.type || "");
      const m = String(t.message || "");
      return (
        a.includes("return") ||
        a.includes("reject") ||
        a.includes("revision") ||
        m.includes("תיקון") ||
        m.includes("הוחזר")
      );
    });
    if (!revs.length && lastComment) {
      return [
        {
          id: "last",
          message: lastComment,
          createdAt: null,
          actorName: null,
        },
      ];
    }
    return revs.map((t) => ({
      id: t.id,
      message: t.message,
      createdAt: t.createdAt,
      actorName: t.actorName ?? null,
    }));
  }

  private static async loadRelated(projectId: string) {
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        OR: [
          {
            sourceType: {
              in: [
                "measurement_sheet",
                "work_diary",
                "delivery_note",
                "partial_invoice",
                "invoice",
                "work_diary_signed",
                "delivery_note_signed",
                "measurement_sheet_signed",
              ],
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        url: true,
        sourceType: true,
        sourceId: true,
        folderPath: true,
      },
    });
    return documents.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      sourceType: d.sourceType,
      kindLabel: kindLabel(d.sourceType || "file"),
      folderPath: d.folderPath,
    }));
  }
}
