import { NextRequest } from "next/server";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const log = await AiParseRepository.findById(id);
    if (!log) return apiError("רשומת ניתוח לא נמצאה", 404);

    const project = log.projectId
      ? await ProjectsRepository.findById(log.projectId)
      : null;

    return apiSuccess({
      id: log.id,
      status: log.status,
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
