import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireOfficeUser();
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
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאת אישור", 403);
    }

    const body = await req.json();
    const kind = body.kind as string;
    const documentId = String(body.documentId ?? "");
    const decision = body.decision as "approved" | "rejected";
    const comment = body.comment as string | undefined;
    const reviewNotes = Array.isArray(body.reviewNotes)
      ? body.reviewNotes
      : undefined;

    if (!documentId || !decision) return apiError("חסרים פרטים");

    if (kind === "work_diary") {
      const diary = await WorkDiariesRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment
      );
      return apiSuccess(diary);
    }

    if (kind === "delivery_note") {
      const note = await OpsDeliveryNotesRepository.decideApproval(
        documentId,
        session.userId,
        decision,
        comment
      );
      return apiSuccess(note);
    }

    if (kind === "measurement_sheet") {
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

    return apiError("סוג מסמך לא תקין");
  } catch (error) {
    return handleApiError(error);
  }
}
