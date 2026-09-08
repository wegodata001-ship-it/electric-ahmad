import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { isFieldManagerRole } from "@/lib/auth/roles";
import { canProjectManagerEditPendingSheet } from "@/lib/auth/measurement-pm-approval-edit";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

async function resolveReviewer(): Promise<{
  userId: string;
  role: string;
  isField: boolean;
}> {
  try {
    const office = await requireOfficeUser();
    return { userId: office.userId, role: office.role, isField: false };
  } catch {
    const field = await requireFieldManager();
    return { userId: field.userId, role: field.role, isField: true };
  }
}

async function loadRelated(projectId: string | null | undefined) {
  if (!projectId) return { documents: [], photos: [] as any[] };

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
        { type: "image" },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      name: true,
      url: true,
      sourceType: true,
      type: true,
      extension: true,
      folderPath: true,
    },
  });

  return {
    documents: documents.filter((d) => d.type !== "image"),
    photos: documents.filter((d) => d.type === "image"),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveReviewer();
    const kind = req.nextUrl.searchParams.get("kind") || "";
    const documentId = req.nextUrl.searchParams.get("documentId") || "";
    if (!kind || !documentId) return apiError("חסרים פרטים");

    if (session.isField || isFieldManagerRole(session.role)) {
      if (kind !== "measurement_sheet") {
        return apiError("מנהל עבודה יכול לצפות רק בדפי מדידה לאישור", 403);
      }
      const pending = await prisma.measurementSheetApproval.findFirst({
        where: {
          sheetId: documentId,
          approverId: session.userId,
          status: "pending",
        },
      });
      if (!pending) {
        return apiError("אין לך דף מדידה ממתין לאישור זה", 403);
      }
      const doc = await MeasurementSheetsRepository.getById(documentId);
      if (!doc) return apiError("דף מדידה לא נמצא", 404);
      const related = await loadRelated(doc.projectId || doc.project?.id);
      return apiSuccess({
        kind,
        document: doc,
        related,
        timeline: (doc.events || []).map((e: any) => ({
          id: e.id,
          action: e.type,
          message: e.message,
          createdAt: e.createdAt,
        })),
        conversation: [],
        workflowDocumentId: null,
      });
    }

    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאת אישור", 403);
    }

    if (kind === "work_diary") {
      const doc = await WorkDiariesRepository.getById(documentId);
      if (!doc) return apiError("יומן לא נמצא", 404);
      const related = await loadRelated(doc.projectId || doc.project?.id);
      let timeline: any[] = [];
      let conversation: any[] = [];
      if (doc.workflowDocumentId) {
        timeline = await WorkflowRepository.timeline(doc.workflowDocumentId);
        conversation = await WorkflowRepository.listConversation(
          doc.workflowDocumentId
        );
      }
      return apiSuccess({
        kind,
        document: doc,
        related,
        timeline,
        conversation,
        workflowDocumentId: doc.workflowDocumentId ?? null,
      });
    }

    if (kind === "delivery_note") {
      const doc = await OpsDeliveryNotesRepository.getById(documentId);
      if (!doc) return apiError("תעודה לא נמצאה", 404);
      const related = await loadRelated(doc.projectId || doc.project?.id);
      return apiSuccess({
        kind,
        document: doc,
        related,
        timeline: (doc.events || []).map((e: any) => ({
          id: e.id,
          action: e.action,
          message: e.message,
          createdAt: e.createdAt,
        })),
        conversation: [],
        workflowDocumentId: null,
      });
    }

    if (kind === "measurement_sheet") {
      const doc = await MeasurementSheetsRepository.getById(documentId);
      if (!doc) return apiError("דף מדידה לא נמצא", 404);
      const related = await loadRelated(doc.projectId || doc.project?.id);
      const canPmEdit = await canProjectManagerEditPendingSheet({
        userId: session.userId,
        role: session.role,
        sheetId: documentId,
        projectId: doc.projectId,
        status: doc.status,
        pendingApproverIds: (doc.approvals || [])
          .filter((a: any) => a.status === "pending")
          .map((a: any) => a.approverId)
          .filter(Boolean),
      });
      return apiSuccess({
        kind,
        document: { ...doc, pmApprovalEdit: canPmEdit },
        canPmEdit,
        related,
        timeline: (doc.events || []).map((e: any) => ({
          id: e.id,
          action: e.type,
          message: e.message,
          actorName: e.actorName,
          createdAt: e.createdAt,
        })),
        conversation: [],
        workflowDocumentId: null,
      });
    }

    return apiError("סוג מסמך לא תקין");
  } catch (error) {
    return handleApiError(error);
  }
}
