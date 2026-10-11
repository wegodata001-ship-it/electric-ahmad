import { NextRequest } from "next/server";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { ProjectsRepository } from "@/repositories/projects.repository";
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
    const log = await AiParseRepository.findById(id);
    if (!log) return apiError("רשומת ניתוח לא נמצאה", 404);

    const isOwner = log.createdById === session.userId;
    const canProject =
      log.projectId != null &&
      (await userCanAccessProject({
        userId: session.userId,
        role: session.role,
        projectId: log.projectId,
      }));
    if (!isOwner && !canProject) {
      return apiError("אין הרשאה", 403);
    }

    const project = log.projectId
      ? await ProjectsRepository.findById(log.projectId)
      : null;

    return apiSuccess({
      id: log.id,
      status: normalizeScanStatus(log.status),
      documentId: log.documentId,
      projectId: log.projectId,
      project,
      itemsDetected: log.itemsDetected,
      fieldsMissing: log.fieldsMissing,
      durationMs: log.durationMs,
      error: log.error,
      parsed: log.resultJson ? JSON.parse(log.resultJson) : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
