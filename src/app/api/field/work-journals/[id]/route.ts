import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const journal = await WorkJournalsRepository.findById(id);
    if (!journal) return apiError("יומן לא נמצא", 404);
    if (journal.foremanId !== session.foremanId) {
      return apiError("אין גישה ליומן זה", 403);
    }
    return apiSuccess(journal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const body = await request.json();
    const journal = await WorkJournalsRepository.updateDraft(
      id,
      session.foremanId,
      {
        projectId: body.projectId,
        date: body.date,
        clientName: body.clientName,
        address: body.address,
        workArea: body.workArea,
        generalNotes: body.generalNotes,
        actionsPerformed: body.actionsPerformed,
        exceptions: body.exceptions,
        equipment: body.equipment,
        notes: body.notes,
        signatureData: body.signatureData,
        status:
          body.status === "in_progress" || body.status === "draft"
            ? body.status
            : undefined,
        workers: body.workers,
        lines: body.lines,
      },
      session.userId
    );
    return apiSuccess(journal);
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
