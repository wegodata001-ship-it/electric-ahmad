import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { isFieldManagerRole } from "@/lib/auth/roles";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { WorkflowTransitionError } from "@/lib/workflow/status-engine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { approvalsDecisionSchema } from "@/lib/validation/schemas";

async function resolveApproverSession(): Promise<{
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

export async function GET() {
  try {
    const session = await resolveApproverSession();

    if (session.isField || isFieldManagerRole(session.role)) {
      // Field managers may approve measurement sheets assigned to them
      const sheets = await MeasurementSheetsRepository.listPendingApprovals(
        session.userId
      );
      return apiSuccess({ items: sheets });
    }

    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאת אישור", 403);
    }

    const [diaries, notes, sheets] = await Promise.all([
      WorkDiariesRepository.listPendingApprovals(session.userId),
      OpsDeliveryNotesRepository.listPendingApprovals(session.userId),
      MeasurementSheetsRepository.listPendingApprovals(session.userId),
    ]);

    const items = [...diaries, ...notes, ...sheets].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );

    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveApproverSession();
    const body = await parseJsonBody(req, approvalsDecisionSchema);
    const kind = body.kind as string | undefined;
    const documentId = body.documentId;
    const decision = body.decision;
    let comment = body.comment;
    const reviewNotes = body.reviewNotes;
    const rejectReasonId = body.rejectReasonId;
    const rejectAttachments = body.rejectAttachments ?? [];
    const approveOptions = body.approveOptions ?? {};

    if (decision === "rejected" && rejectReasonId) {
      const { formatRejectComment } = await import(
        "@/lib/approvals/reject-reasons"
      );
      if (!comment?.trim()) {
        return apiError("חובה לרשום הערות להחזרה לתיקון");
      }
      comment = formatRejectComment({
        reasonId: rejectReasonId,
        notes: comment,
        attachmentUrls: rejectAttachments,
      });
    }

    if (session.isField || isFieldManagerRole(session.role)) {
      if (kind !== "measurement_sheet") {
        return apiError("מנהל עבודה יכול לאשר רק דפי מדידה", 403);
      }
      const sheet = await MeasurementSheetsRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment,
        reviewNotes,
        req.nextUrl.origin
      );
      return apiSuccess(sheet);
    }

    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאת אישור", 403);
    }

    let result: any;

    if (kind === "work_diary") {
      result = await WorkDiariesRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment
      );
    } else if (kind === "delivery_note") {
      result = await OpsDeliveryNotesRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment
      );
    } else if (kind === "measurement_sheet") {
      result = await MeasurementSheetsRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment,
        reviewNotes,
        req.nextUrl.origin
      );
    } else {
      return apiError("סוג מסמך לא תקין");
    }

    // Post-approve options (best-effort)
    if (decision === "approved" && result?.approvalComplete !== false) {
      if (approveOptions.saveToDocuments !== false) {
        try {
          const { DocumentsHubRepository } = await import(
            "@/repositories/documents-hub.repository"
          );
          await DocumentsHubRepository.ensureInArchive({
            kind: kind!,
            entityId: documentId,
            userId: session.userId,
            baseUrl: req.nextUrl.origin,
          });
          result.savedToDocuments = true;
        } catch {
          /* optional — יומן כבר מסונכרן לעיתים */
        }
      }
      if (approveOptions.sendToClient && kind === "measurement_sheet") {
        try {
          await MeasurementSheetsRepository.createClientSignLink(
            documentId,
            session.userId,
            req.nextUrl.origin
          );
          result.clientLinkCreated = true;
        } catch {
          /* optional */
        }
      }
      if (
        approveOptions.sendToClient &&
        kind === "work_diary" &&
        result?.status === "approved"
      ) {
        try {
          await WorkDiariesRepository.createClientSignLink(
            documentId,
            session.userId,
            req.nextUrl.origin
          );
          result.clientLinkCreated = true;
        } catch {
          /* optional */
        }
      }
      if (
        approveOptions.sendToClient &&
        kind === "delivery_note" &&
        (result?.status === "approved" || result?.status === "sent_to_client")
      ) {
        try {
          const { hasDocumentPermission } = await import(
            "@/lib/auth/document-permissions"
          );
          if (hasDocumentPermission(session.role, "send_to_client")) {
            await OpsDeliveryNotesRepository.createClientSignLink(
              documentId,
              session.userId,
              req.nextUrl.origin
            );
            result.clientLinkCreated = true;
          }
        } catch {
          /* optional */
        }
      }
    }

    return apiSuccess({
      ...result,
      approveOptionsApplied: approveOptions,
    });
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return apiError(error.message, 400);
    }
    if (error instanceof Error) {
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}
