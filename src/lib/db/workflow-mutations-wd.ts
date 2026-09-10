import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newDbId } from "@/lib/db/new-id";

function approvalValuesSql(pairs: { id: string; approverId: string }[]) {
  return Prisma.join(
    pairs.map((p) => Prisma.sql`(${p.id}, ${p.approverId})`)
  );
}

export type WfMutateResult = {
  id: string;
  kind: string;
  projectId: string;
  title: string;
  documentNumber: string;
  status: string;
  version: number;
  createdById: string | null;
  workDiaryId: string;
  diaryDocumentNumber: string;
  diaryProjectId: string;
  diaryCreatedById: string;
};

/**
 * Single round-trip WD submit/resubmit: diary+workflow status gate,
 * approvals, version, event, legacy diary status.
 */
export async function workflowSubmitAnyOneSql(input: {
  workDiaryId: string;
  actorId: string;
  approverIds: string[];
  actorName?: string | null;
}): Promise<WfMutateResult | null> {
  const uniqueApproverIds = [...new Set(input.approverIds.filter(Boolean))];
  if (!uniqueApproverIds.length) return null;
  const pairs = uniqueApproverIds.map((approverId) => ({
    id: newDbId(),
    approverId,
  }));
  const versionId = newDbId();
  const eventId = newDbId();
  const metaJson = JSON.stringify({ approverIds: uniqueApproverIds });

  const rows = await prisma.$queryRaw<WfMutateResult[]>`
    WITH target AS (
      SELECT
        w.id AS "workDiaryId",
        w."documentNumber" AS "diaryDocumentNumber",
        w."projectId" AS "diaryProjectId",
        w."createdById" AS "diaryCreatedById",
        d.id AS "documentId",
        d.kind::text AS kind,
        d."projectId",
        d.title,
        d."documentNumber",
        d.status::text AS from_status,
        d.version,
        d."createdById",
        CASE
          WHEN d.status = 'revision'::"WorkflowStatus" THEN 'resubmit'
          ELSE 'submit'
        END AS action,
        CASE
          WHEN d.status = 'revision'::"WorkflowStatus" THEN 'נשלח מחדש לאישור'
          ELSE 'טיוטה → ממתין לאישור'
        END AS event_message,
        CASE
          WHEN d.status = 'revision'::"WorkflowStatus" THEN 'resubmit: ממתין לאישור'
          ELSE 'submit: ממתין לאישור'
        END AS version_note
      FROM "WorkDiary" w
      JOIN "WorkflowDocument" d ON d.id = w."workflowDocumentId"
      WHERE w.id = ${input.workDiaryId}
        AND w."deletedAt" IS NULL
        AND w."workflowDocumentId" IS NOT NULL
        AND d.status IN (
          'draft'::"WorkflowStatus",
          'revision'::"WorkflowStatus"
        )
    ),
    doc AS (
      UPDATE "WorkflowDocument" d
      SET
        status = 'pending_approval'::"WorkflowStatus",
        version = d.version + 1,
        "updatedById" = ${input.actorId},
        "updatedAt" = NOW()
      FROM target
      WHERE d.id = target."documentId"
      RETURNING
        d.id,
        d.kind::text AS kind,
        d."projectId",
        d.title,
        d."documentNumber",
        d.status::text AS status,
        d.version,
        d."createdById"
    ),
    cancelled AS (
      UPDATE "WorkflowApproval" a
      SET status = 'cancelled'::"WorkflowApprovalStatus"
      WHERE a."documentId" = (SELECT "documentId" FROM target)
        AND a.status = 'pending'::"WorkflowApprovalStatus"
        AND EXISTS (SELECT 1 FROM doc)
      RETURNING a.id
    ),
    inserted AS (
      INSERT INTO "WorkflowApproval" (
        id, "documentId", "approverId", status, "sentAt", "createdAt"
      )
      SELECT
        x.id,
        target."documentId",
        x."approverId",
        'pending'::"WorkflowApprovalStatus",
        NOW(),
        NOW()
      FROM target
      CROSS JOIN (VALUES ${approvalValuesSql(pairs)}) AS x(id, "approverId")
      WHERE EXISTS (SELECT 1 FROM doc)
      RETURNING id
    ),
    ver AS (
      INSERT INTO "WorkflowDocVersion" (
        id, "documentId", version, status, note, "actorId", "snapshotJson", "createdAt"
      )
      SELECT
        ${versionId},
        doc.id,
        doc.version,
        'pending_approval'::"WorkflowStatus",
        target.version_note,
        ${input.actorId},
        '{}',
        NOW()
      FROM doc
      CROSS JOIN target
      RETURNING id
    ),
    ev AS (
      INSERT INTO "WorkflowEvent" (
        id, "documentId", type, message, "fromStatus", "toStatus", "actorId", metadata, "createdAt"
      )
      SELECT
        ${eventId},
        doc.id,
        target.action,
        target.event_message,
        target.from_status::"WorkflowStatus",
        'pending_approval'::"WorkflowStatus",
        ${input.actorId},
        ${metaJson}::text,
        NOW()
      FROM doc
      CROSS JOIN target
      RETURNING id
    ),
    diary AS (
      UPDATE "WorkDiary" w
      SET
        status = 'pending_approval'::"WorkDiaryStatus",
        "updatedById" = ${input.actorId},
        "updatedAt" = NOW()
      FROM target
      WHERE w.id = target."workDiaryId"
        AND EXISTS (SELECT 1 FROM doc)
      RETURNING w.id
    )
    SELECT
      doc.*,
      target."workDiaryId",
      target."diaryDocumentNumber",
      target."diaryProjectId",
      target."diaryCreatedById"
    FROM doc
    CROSS JOIN target
  `;

  return rows[0] ?? null;
}

/**
 * Single round-trip WD approve/reject + legacy diary sync.
 */
export async function workflowDecideAnyOneSql(input: {
  workDiaryId: string;
  actorId: string;
  decision: "approved" | "rejected";
  comment?: string | null;
  correctionMode?: "manual" | "note";
  actorName?: string | null;
}): Promise<WfMutateResult | null> {
  const versionId = newDbId();
  const eventId = newDbId();
  const comment = input.comment?.trim() || null;
  const correctionMode = input.correctionMode ?? null;
  const approvalStatus =
    input.decision === "approved" ? "approved" : "rejected";
  const diaryStatus =
    input.decision === "approved" ? "approved" : "revision";
  const toStatus =
    input.decision === "approved" ? "approved" : "revision";
  const eventType = input.decision === "approved" ? "approve" : "reject";
  const actorLabel = input.actorName?.trim() || "המאשר";
  const eventMessage =
    input.decision === "rejected"
      ? correctionMode === "manual"
        ? `${actorLabel} ביצע החזרה לתיקון ידני`
        : `${actorLabel} החזיר לתיקון לפי הערה: ${comment || "ללא פירוט"}`
      : "ממתין לאישור → אושר";
  const versionNote =
    input.decision === "approved"
      ? "approve: אושר"
      : "reject: הוחזר לתיקון";
  const metaJson = JSON.stringify({ comment, correctionMode });

  if (input.decision === "rejected" && !comment) {
    return null;
  }

  const rows = await prisma.$queryRaw<WfMutateResult[]>`
    WITH target AS (
      SELECT
        w.id AS "workDiaryId",
        w."documentNumber" AS "diaryDocumentNumber",
        w."projectId" AS "diaryProjectId",
        w."createdById" AS "diaryCreatedById",
        d.id AS "documentId",
        d.kind::text AS kind,
        d."projectId",
        d.title,
        d."documentNumber",
        d.status::text AS from_status,
        d.version,
        d."createdById"
      FROM "WorkDiary" w
      JOIN "WorkflowDocument" d ON d.id = w."workflowDocumentId"
      WHERE w.id = ${input.workDiaryId}
        AND w."deletedAt" IS NULL
        AND w."workflowDocumentId" IS NOT NULL
        AND d.status = 'pending_approval'::"WorkflowStatus"
    ),
    mine AS (
      SELECT a.id
      FROM "WorkflowApproval" a
      JOIN target ON a."documentId" = target."documentId"
      WHERE a."approverId" = ${input.actorId}
        AND a.status = 'pending'::"WorkflowApprovalStatus"
      LIMIT 1
    ),
    claimed AS (
      UPDATE "WorkflowApproval" a
      SET
        status = ${approvalStatus}::"WorkflowApprovalStatus",
        comment = ${comment}::text,
        "decidedAt" = NOW()
      FROM mine
      WHERE a.id = mine.id
      RETURNING a.id
    ),
    cancelled AS (
      UPDATE "WorkflowApproval" a
      SET status = 'cancelled'::"WorkflowApprovalStatus"
      WHERE a."documentId" = (SELECT "documentId" FROM target)
        AND a.status = 'pending'::"WorkflowApprovalStatus"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING a.id
    ),
    doc AS (
      UPDATE "WorkflowDocument" d
      SET
        status = ${toStatus}::"WorkflowStatus",
        version = d.version + 1,
        "updatedById" = ${input.actorId},
        "updatedAt" = NOW()
      FROM target
      WHERE d.id = target."documentId"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING
        d.id,
        d.kind::text AS kind,
        d."projectId",
        d.title,
        d."documentNumber",
        d.status::text AS status,
        d.version,
        d."createdById"
    ),
    ver AS (
      INSERT INTO "WorkflowDocVersion" (
        id, "documentId", version, status, note, "actorId", "snapshotJson", "createdAt"
      )
      SELECT
        ${versionId},
        doc.id,
        doc.version,
        ${toStatus}::"WorkflowStatus",
        ${versionNote},
        ${input.actorId},
        '{}',
        NOW()
      FROM doc
      RETURNING id
    ),
    ev AS (
      INSERT INTO "WorkflowEvent" (
        id, "documentId", type, message, "fromStatus", "toStatus", "actorId", metadata, "createdAt"
      )
      SELECT
        ${eventId},
        doc.id,
        ${eventType},
        ${eventMessage},
        'pending_approval'::"WorkflowStatus",
        ${toStatus}::"WorkflowStatus",
        ${input.actorId},
        ${metaJson}::text,
        NOW()
      FROM doc
      RETURNING id
    ),
    diary AS (
      UPDATE "WorkDiary" w
      SET
        status = ${diaryStatus}::"WorkDiaryStatus",
        "updatedById" = ${input.actorId},
        "updatedAt" = NOW()
      FROM target
      WHERE w.id = target."workDiaryId"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING w.id
    ),
    legacy_claim AS (
      UPDATE "WorkDiaryApproval" a
      SET
        status = ${approvalStatus}::"DocApprovalStatus",
        comment = ${comment}::text,
        "decidedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE a."workDiaryId" = ${input.workDiaryId}
        AND a."approverId" = ${input.actorId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING a.id
    ),
    legacy_cancel AS (
      UPDATE "WorkDiaryApproval" a
      SET status = 'cancelled'::"DocApprovalStatus", "updatedAt" = NOW()
      WHERE a."workDiaryId" = ${input.workDiaryId}
        AND a.status = 'pending'::"DocApprovalStatus"
        AND EXISTS (SELECT 1 FROM claimed)
      RETURNING a.id
    )
    SELECT
      doc.*,
      target."workDiaryId",
      target."diaryDocumentNumber",
      target."diaryProjectId",
      target."diaryCreatedById"
    FROM doc
    CROSS JOIN target
  `;

  return rows[0] ?? null;
}
