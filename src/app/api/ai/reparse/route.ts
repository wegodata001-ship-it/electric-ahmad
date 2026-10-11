import { z } from "zod";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { idString } from "@/lib/validation/schemas";
import { SCAN_STATUS } from "@/lib/ai/scan-job";
import {
  enforceRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export const maxDuration = 30;

const AI_BUCKET = "ai-reparse";
const AI_LIMIT = 20;
const AI_WINDOW_MS = 60 * 60 * 1000;

const reparseSchema = z.object({
  projectId: idString,
  documentId: idString,
});

export async function POST(request: Request) {
  try {
    const { userId } = await getAuthContext();

    const ip = getClientIp(request);
    const limited = enforceRateLimit(
      {
        key: `${AI_BUCKET}:${ip}:${userId}`,
        limit: AI_LIMIT,
        windowMs: AI_WINDOW_MS,
      },
      "יותר מדי בקשות עיבוד AI. נסו שוב בעוד רגע."
    );
    if (limited) return limited;

    const body = await parseJsonBody(request, reparseSchema);

    const parseLog = await AiParseRepository.create({
      documentType: "contract_boq",
      documentId: body.documentId,
      projectId: body.projectId,
      status: SCAN_STATUS.QUEUED,
      startedAt: new Date(),
      createdById: userId,
    });

    return apiSuccess({
      parseLogId: parseLog.id,
      pending: true,
      success: false,
      status: SCAN_STATUS.QUEUED,
      parsed: null,
      missingFields: [],
      itemsDetected: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
