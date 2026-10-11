import { NextRequest } from "next/server";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { processScanJob } from "@/lib/ai/process-scan-job";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { isTerminalScanStatus, SCAN_STATUS } from "@/lib/ai/scan-job";

export const maxDuration = 300;

export async function POST(
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

    if (isTerminalScanStatus(log.status) && log.status !== SCAN_STATUS.FAILED && log.status !== SCAN_STATUS.TIMED_OUT) {
      return apiSuccess({
        parseLogId: log.id,
        status: log.status,
        skipped: true,
        success: log.status === SCAN_STATUS.COMPLETED || log.status === SCAN_STATUS.CONFIRMED,
        parsed: log.resultJson ? JSON.parse(log.resultJson) : null,
        itemsDetected: log.itemsDetected,
        error: log.error ?? undefined,
      });
    }

    if (log.status === SCAN_STATUS.PROCESSING || log.status === SCAN_STATUS.VALIDATING) {
      return apiSuccess({
        parseLogId: log.id,
        status: log.status,
        skipped: true,
        success: false,
        pending: true,
      });
    }

    const result = await processScanJob({
      parseLogId: log.id,
      userId: session.userId,
    });

    return apiSuccess({
      parseLogId: log.id,
      pending: result.status === SCAN_STATUS.QUEUED || result.status === SCAN_STATUS.PROCESSING,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
