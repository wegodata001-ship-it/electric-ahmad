import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { AuditRepository } from "@/repositories/audit.repository";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const journal = await WorkJournalsRepository.submit(
      id,
      session.foremanId,
      session.userId
    );

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "WorkJournal",
      entityId: id,
      userId: session.userId,
      metadata: {
        action: "submit",
        managerId: session.foremanId,
        projectId: journal.projectId,
        userId: session.userId,
        datetime: new Date().toISOString(),
      },
    });

    return apiSuccess(journal);
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
