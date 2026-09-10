import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newDbId } from "@/lib/db/new-id";

type MsSubmitResult = {
  id: string;
  title: string;
  projectId: string;
  sequenceNumber: number;
  currentVersion: number;
  rowCount: number;
  cellCount: number;
};

function approvalValuesSql(pairs: { id: string; approverId: string }[]) {
  return Prisma.join(
    pairs.map((p) => Prisma.sql`(${p.id}, ${p.approverId})`)
  );
}

/**
 * Single round-trip MS submit/resubmit mutation.
 * Status-gated: 0 rows means sheet is not editable / already finalized.
 */
export async function msSubmitForApprovalSql(input: {
  sheetId: string;
  userId: string;
  approverIds: string[];
}): Promise<MsSubmitResult | null> {
  const uniqueApproverIds = [...new Set(input.approverIds.filter(Boolean))];
  if (!uniqueApproverIds.length) return null;

  const pairs = uniqueApproverIds.map((approverId) => ({
    id: newDbId(),
    approverId,
  }));
  const versionId = newDbId();
  const eventId = newDbId();
  const approverJson = JSON.stringify(uniqueApproverIds);

  const rows = await prisma.$queryRaw<MsSubmitResult[]>`
    WITH target AS (
      SELECT
        s.id,
        s.title,
        s."projectId",
        s."sequenceNumber",
        s.status,
        s."submittedAt",
        s."currentVersion",
        (SELECT COUNT(*)::int FROM "MeasurementSheetRow" r WHERE r."sheetId" = s.id) AS "rowCount",
        (SELECT COUNT(*)::int FROM "MeasurementCell" c WHERE c."sheetId" = s.id) AS "cellCount",
        CASE
          WHEN s.status = 'revision'::"MeasurementSheetStatus" OR s."submittedAt" IS NOT NULL
            THEN COALESCE(s."currentVersion", 1) + 1
          ELSE GREATEST(1, COALESCE(s."currentVersion", 1))
        END AS next_version,
        CASE
          WHEN s.status = 'revision'::"MeasurementSheetStatus"
            THEN 'תוקן ונשלח מחדש לאישור'
          ELSE 'נשלח לאישור'
        END AS submit_note
      FROM "MeasurementSheet" s
      WHERE s.id = ${input.sheetId}
        AND s.status IN (
          'draft'::"MeasurementSheetStatus",
          'revision'::"MeasurementSheetStatus",
          'pending_approval'::"MeasurementSheetStatus"
        )
    ),
    sheet AS (
      UPDATE "MeasurementSheet" s
      SET
        status = 'pending_approval'::"MeasurementSheetStatus",
        "currentVersion" = target.next_version,
        "submittedAt" = NOW(),
        "approvedAt" = NULL,
        "returnedAt" = NULL,
        "lastReturnComment" = NULL,
        "updatedById" = ${input.userId},
        "updatedAt" = NOW()
      FROM target
      WHERE s.id = target.id
      RETURNING
        s.id,
        s.title,
        s."projectId",
        s."sequenceNumber",
        s."currentVersion",
        target."rowCount",
        target."cellCount",
        target.submit_note
    ),
    cancelled AS (
      UPDATE "MeasurementSheetApproval" a
      SET status = 'cancelled'::"DocApprovalStatus"
      WHERE a."sheetId" = ${input.sheetId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM sheet)
      RETURNING a.id
    ),
    inserted AS (
      INSERT INTO "MeasurementSheetApproval" (id, "sheetId", "approverId", status, "sentAt", "createdAt")
      SELECT
        x.id,
        ${input.sheetId},
        x."approverId",
        'pending'::"DocApprovalStatus",
        NOW(),
        NOW()
      FROM (VALUES ${approvalValuesSql(pairs)}) AS x(id, "approverId")
      WHERE EXISTS (SELECT 1 FROM sheet)
      RETURNING id
    ),
    ver AS (
      INSERT INTO "MeasurementSheetVersion" (
        id, "sheetId", version, status, "snapshotJson", note, "actorId", "createdAt"
      )
      SELECT
        ${versionId},
        sheet.id,
        COALESCE((
          SELECT MAX(v.version) FROM "MeasurementSheetVersion" v WHERE v."sheetId" = sheet.id
        ), 0) + 1,
        'pending_approval'::"MeasurementSheetStatus",
        json_build_object(
          'id', sheet.id,
          'title', sheet.title,
          'projectId', sheet."projectId",
          'status', 'pending_approval',
          'currentVersion', sheet."currentVersion",
          'sequenceNumber', sheet."sequenceNumber",
          'rowCount', sheet."rowCount",
          'cellCount', sheet."cellCount",
          'approverIds', ${approverJson}::jsonb
        )::text,
        'V' || sheet."currentVersion" || ' ' || sheet.submit_note,
        ${input.userId},
        NOW()
      FROM sheet
      RETURNING id
    ),
    ev AS (
      INSERT INTO "MeasurementSheetEvent" (
        id, "sheetId", type, message, "actorId", metadata, "createdAt"
      )
      SELECT
        ${eventId},
        sheet.id,
        'submitted',
        'V' || sheet."currentVersion" || ' נשלח לאישור',
        ${input.userId},
        json_build_object(
          'version', sheet."currentVersion",
          'approverIds', ${approverJson}::jsonb
        )::text,
        NOW()
      FROM sheet
      RETURNING id
    )
    SELECT
      sheet.id,
      sheet.title,
      sheet."projectId",
      sheet."sequenceNumber",
      sheet."currentVersion",
      sheet."rowCount",
      sheet."cellCount"
    FROM sheet
  `;

  return rows[0] ?? null;
}

type MsDecideResult = {
  id: string;
  title: string;
  projectId: string;
  currentVersion: number;
  status: string;
  lastReturnComment: string | null;
  createdById: string;
};

export async function msDecideApprovalSql(input: {
  sheetId: string;
  approverId: string;
  decision: "approved" | "rejected";
  comment?: string | null;
  correctionMode?: "manual" | "note";
}): Promise<MsDecideResult | null> {
  const versionId = newDbId();
  const eventId = newDbId();
  const summary =
    input.decision === "rejected"
      ? input.correctionMode === "manual"
        ? "תיקון ידני על ידי המאשר"
        : input.comment?.trim() || "הוחזר לתיקון עם הערות על שורות"
      : input.comment ?? null;
  const correctionMode = input.correctionMode ?? "note";

  if (input.decision === "rejected") {
    const rows = await prisma.$queryRaw<MsDecideResult[]>`
      WITH mine AS (
        SELECT a.id
        FROM "MeasurementSheetApproval" a
        JOIN "MeasurementSheet" s ON s.id = a."sheetId"
        WHERE a."sheetId" = ${input.sheetId}
          AND a."approverId" = ${input.approverId}
          AND a.status = 'pending'::"DocApprovalStatus"
          AND s.status = 'pending_approval'::"MeasurementSheetStatus"
        LIMIT 1
      ),
      claimed AS (
        UPDATE "MeasurementSheetApproval" a
        SET
          status = 'rejected'::"DocApprovalStatus",
          comment = ${summary},
          "decidedAt" = NOW()
        FROM mine
        WHERE a.id = mine.id
        RETURNING a.id
      ),
      cancelled AS (
        UPDATE "MeasurementSheetApproval" a
        SET status = 'cancelled'::"DocApprovalStatus"
        WHERE a."sheetId" = ${input.sheetId}
          AND a.status = 'pending'::"DocApprovalStatus"
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING a.id
      ),
      sheet AS (
        UPDATE "MeasurementSheet" s
        SET
          status = 'revision'::"MeasurementSheetStatus",
          "returnedAt" = NOW(),
          "lastReturnComment" = ${summary},
          "updatedById" = ${input.approverId},
          "updatedAt" = NOW()
        WHERE s.id = ${input.sheetId}
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING
          s.id,
          s.title,
          s."projectId",
          s."currentVersion",
          s.status::text AS status,
          s."lastReturnComment",
          s."createdById"
      ),
      ver AS (
        INSERT INTO "MeasurementSheetVersion" (
          id, "sheetId", version, status, "snapshotJson", note, "actorId", "createdAt"
        )
        SELECT
          ${versionId},
          sheet.id,
          COALESCE((SELECT MAX(v.version) FROM "MeasurementSheetVersion" v WHERE v."sheetId" = sheet.id), 0) + 1,
          'revision'::"MeasurementSheetStatus",
          '{}',
          'V' || sheet."currentVersion" || ' הוחזר לתיקון: ' || ${summary},
          ${input.approverId},
          NOW()
        FROM sheet
        RETURNING id
      ),
      ev AS (
        INSERT INTO "MeasurementSheetEvent" (
          id, "sheetId", type, message, "actorId", metadata, "createdAt"
        )
        SELECT
          ${eventId},
          sheet.id,
          'returned',
          CASE
            WHEN ${correctionMode} = 'manual'
              THEN 'המאשר ביצע החזרה לתיקון ידני'
            ELSE 'הוחזר לתיקון לפי הערה: ' || ${summary}
          END,
          ${input.approverId},
          json_build_object('correctionMode', ${correctionMode})::text,
          NOW()
        FROM sheet
        RETURNING id
      )
      SELECT * FROM sheet
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<MsDecideResult[]>`
    WITH mine AS (
      SELECT a.id
      FROM "MeasurementSheetApproval" a
      JOIN "MeasurementSheet" s ON s.id = a."sheetId"
      WHERE a."sheetId" = ${input.sheetId}
        AND a."approverId" = ${input.approverId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND s.status = 'pending_approval'::"MeasurementSheetStatus"
      LIMIT 1
    ),
    claimed AS (
      UPDATE "MeasurementSheetApproval" a
      SET
        status = 'approved'::"DocApprovalStatus",
        comment = ${summary},
        "decidedAt" = NOW()
      FROM mine
      WHERE a.id = mine.id
      RETURNING a.id
    ),
    cancelled AS (
      UPDATE "MeasurementSheetApproval" a
      SET status = 'cancelled'::"DocApprovalStatus"
      WHERE a."sheetId" = ${input.sheetId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING a.id
    ),
    sheet AS (
      UPDATE "MeasurementSheet" s
      SET
        status = 'approved'::"MeasurementSheetStatus",
        "approvedAt" = NOW(),
        "updatedById" = ${input.approverId},
        "updatedAt" = NOW()
      WHERE s.id = ${input.sheetId}
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING
        s.id,
        s.title,
        s."projectId",
        s."currentVersion",
        s.status::text AS status,
        s."lastReturnComment",
        s."createdById"
    ),
    ver AS (
      INSERT INTO "MeasurementSheetVersion" (
        id, "sheetId", version, status, "snapshotJson", note, "actorId", "createdAt"
      )
      SELECT
        ${versionId},
        sheet.id,
        COALESCE((SELECT MAX(v.version) FROM "MeasurementSheetVersion" v WHERE v."sheetId" = sheet.id), 0) + 1,
        'approved'::"MeasurementSheetStatus",
        '{}',
        'V' || sheet."currentVersion" || ' אושר (אישור יחיד)',
        ${input.approverId},
        NOW()
      FROM sheet
      RETURNING id
    ),
    ev AS (
      INSERT INTO "MeasurementSheetEvent" (
        id, "sheetId", type, message, "actorId", metadata, "createdAt"
      )
      SELECT
        ${eventId},
        sheet.id,
        'approved',
        'V' || sheet."currentVersion" || ' אושר',
        ${input.approverId},
        '{"mode":"any_one"}',
        NOW()
      FROM sheet
      RETURNING id
    )
    SELECT * FROM sheet
  `;
  return rows[0] ?? null;
}
