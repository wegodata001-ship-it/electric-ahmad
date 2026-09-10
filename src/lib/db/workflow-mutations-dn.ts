import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newDbId } from "@/lib/db/new-id";

function approvalValuesSql(pairs: { id: string; approverId: string }[]) {
  return Prisma.join(
    pairs.map((p) => Prisma.sql`(${p.id}, ${p.approverId})`)
  );
}

type DnResult = {
  id: string;
  documentNumber: string;
  projectId: string | null;
  createdById: string;
  status: string;
};

export async function dnSubmitForApprovalSql(input: {
  noteId: string;
  actorId: string;
  approverIds: string[];
}): Promise<(DnResult & { wasResubmit: boolean }) | null> {
  const uniqueApproverIds = [...new Set(input.approverIds.filter(Boolean))];
  if (!uniqueApproverIds.length) return null;
  const pairs = uniqueApproverIds.map((approverId) => ({
    id: newDbId(),
    approverId,
  }));
  const eventId = newDbId();

  const rows = await prisma.$queryRaw<(DnResult & { wasResubmit: boolean })[]>`
    WITH target AS (
      SELECT
        n.id,
        n."documentNumber",
        n."projectId",
        n."createdById",
        n.status,
        (n.status = 'revision'::"OpsDeliveryNoteStatus") AS "wasResubmit"
      FROM "OpsDeliveryNote" n
      WHERE n.id = ${input.noteId}
        AND n."deletedAt" IS NULL
        AND n.status IN (
          'draft'::"OpsDeliveryNoteStatus",
          'revision'::"OpsDeliveryNoteStatus",
          'pending_approval'::"OpsDeliveryNoteStatus"
        )
    ),
    note AS (
      UPDATE "OpsDeliveryNote" n
      SET
        status = 'pending_approval'::"OpsDeliveryNoteStatus",
        "updatedById" = ${input.actorId},
        "updatedAt" = NOW()
      FROM target
      WHERE n.id = target.id
      RETURNING
        n.id,
        n."documentNumber",
        n."projectId",
        n."createdById",
        n.status::text AS status,
        target."wasResubmit"
    ),
    cancelled AS (
      UPDATE "OpsDeliveryNoteApproval" a
      SET status = 'cancelled'::"DocApprovalStatus", "updatedAt" = NOW()
      WHERE a."opsDeliveryNoteId" = ${input.noteId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM note)
      RETURNING a.id
    ),
    inserted AS (
      INSERT INTO "OpsDeliveryNoteApproval" (
        id, "opsDeliveryNoteId", "approverId", status, "sentAt", "createdAt", "updatedAt"
      )
      SELECT
        x.id,
        ${input.noteId},
        x."approverId",
        'pending'::"DocApprovalStatus",
        NOW(),
        NOW(),
        NOW()
      FROM (VALUES ${approvalValuesSql(pairs)}) AS x(id, "approverId")
      WHERE EXISTS (SELECT 1 FROM note)
      RETURNING id
    ),
    ev AS (
      INSERT INTO "OpsDeliveryNoteEvent" (
        id, "opsDeliveryNoteId", action, message, "actorId", "createdAt"
      )
      SELECT
        ${eventId},
        note.id,
        CASE WHEN note."wasResubmit" THEN 'resubmitted' ELSE 'submitted' END,
        CASE WHEN note."wasResubmit" THEN 'נשלחה מחדש לאישור' ELSE 'נשלחה לאישור' END,
        ${input.actorId},
        NOW()
      FROM note
      RETURNING id
    )
    SELECT * FROM note
  `;
  return rows[0] ?? null;
}

export async function dnDecideApprovalSql(input: {
  noteId: string;
  approverId: string;
  decision: "approved" | "rejected";
  comment?: string | null;
  correctionMode?: "manual" | "note";
}): Promise<DnResult | null> {
  const eventId = newDbId();
  if (input.decision === "rejected") {
    const comment = input.comment?.trim() || null;
    if (!comment) return null;
    const message =
      input.correctionMode === "manual"
        ? "המאשר ביצע החזרה לתיקון ידני"
        : `הוחזרה לתיקון לפי הערה: ${comment}`;

    const rows = await prisma.$queryRaw<DnResult[]>`
      WITH mine AS (
        SELECT a.id
        FROM "OpsDeliveryNoteApproval" a
        JOIN "OpsDeliveryNote" n ON n.id = a."opsDeliveryNoteId"
        WHERE a."opsDeliveryNoteId" = ${input.noteId}
          AND a."approverId" = ${input.approverId}
          AND a.status = 'pending'::"DocApprovalStatus"
          AND n."deletedAt" IS NULL
        LIMIT 1
      ),
      claimed AS (
        UPDATE "OpsDeliveryNoteApproval" a
        SET
          status = 'rejected'::"DocApprovalStatus",
          comment = ${comment},
          "decidedAt" = NOW(),
          "updatedAt" = NOW()
        FROM mine
        WHERE a.id = mine.id
        RETURNING a.id
      ),
      cancelled AS (
        UPDATE "OpsDeliveryNoteApproval" a
        SET status = 'cancelled'::"DocApprovalStatus", "updatedAt" = NOW()
        WHERE a."opsDeliveryNoteId" = ${input.noteId}
          AND a.status = 'pending'::"DocApprovalStatus"
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING a.id
      ),
      note AS (
        UPDATE "OpsDeliveryNote" n
        SET
          status = 'revision'::"OpsDeliveryNoteStatus",
          "updatedById" = ${input.approverId},
          "updatedAt" = NOW()
        WHERE n.id = ${input.noteId}
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING n.id, n."documentNumber", n."projectId", n."createdById", n.status::text AS status
      ),
      ev AS (
        INSERT INTO "OpsDeliveryNoteEvent" (
          id, "opsDeliveryNoteId", action, message, "actorId", "createdAt"
        )
        SELECT ${eventId}, note.id, 'returned', ${message}, ${input.approverId}, NOW()
        FROM note
        RETURNING id
      )
      SELECT * FROM note
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<DnResult[]>`
    WITH mine AS (
      SELECT a.id
      FROM "OpsDeliveryNoteApproval" a
      JOIN "OpsDeliveryNote" n ON n.id = a."opsDeliveryNoteId"
      WHERE a."opsDeliveryNoteId" = ${input.noteId}
        AND a."approverId" = ${input.approverId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND n."deletedAt" IS NULL
      LIMIT 1
    ),
    claimed AS (
      UPDATE "OpsDeliveryNoteApproval" a
      SET
        status = 'approved'::"DocApprovalStatus",
        comment = ${input.comment ?? null},
        "decidedAt" = NOW(),
        "updatedAt" = NOW()
      FROM mine
      WHERE a.id = mine.id
      RETURNING a.id
    ),
    cancelled AS (
      UPDATE "OpsDeliveryNoteApproval" a
      SET status = 'cancelled'::"DocApprovalStatus", "updatedAt" = NOW()
      WHERE a."opsDeliveryNoteId" = ${input.noteId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING a.id
    ),
    note AS (
      UPDATE "OpsDeliveryNote" n
      SET
        status = 'approved'::"OpsDeliveryNoteStatus",
        "updatedById" = ${input.approverId},
        "updatedAt" = NOW()
      WHERE n.id = ${input.noteId}
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING n.id, n."documentNumber", n."projectId", n."createdById", n.status::text AS status
    ),
    ev AS (
      INSERT INTO "OpsDeliveryNoteEvent" (
        id, "opsDeliveryNoteId", action, message, "actorId", "createdAt"
      )
      SELECT ${eventId}, note.id, 'approved', 'התעודה אושרה', ${input.approverId}, NOW()
      FROM note
      RETURNING id
    )
    SELECT * FROM note
  `;
  return rows[0] ?? null;
}
