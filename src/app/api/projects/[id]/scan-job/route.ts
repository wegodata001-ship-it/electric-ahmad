import { NextRequest } from "next/server";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { normalizeScanStatus } from "@/lib/ai/scan-job";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOfficeUser();
    const { id } = await params;
    const allowed = await userCanAccessProject({
      userId: session.userId,
      role: session.role,
      projectId: id,
    });
    if (!allowed) return apiError("אין הרשאה לפרויקט זה", 403);

    const log = await AiParseRepository.findLatestForProject(id);
    if (!log) {
      return apiSuccess({ job: null });
    }

    return apiSuccess({
      job: {
        id: log.id,
        status: normalizeScanStatus(log.status),
        documentId: log.documentId,
        projectId: log.projectId,
        itemsDetected: log.itemsDetected,
        fieldsMissing: log.fieldsMissing,
        error: log.error,
        errorCode: log.errorCode,
        parsed: log.resultJson ? JSON.parse(log.resultJson) : null,
        createdAt: log.createdAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
