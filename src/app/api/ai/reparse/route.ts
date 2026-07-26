import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AiDocumentParserService } from "@/lib/ai/document-parser.service";
import type { ParsedContractBoqResult } from "@/lib/ai/types";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { idString } from "@/lib/validation/schemas";
import {
  enforceRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export const maxDuration = 300;

const AI_BUCKET = "ai-reparse";
const AI_LIMIT = 20;
const AI_WINDOW_MS = 60 * 60 * 1000;

const reparseSchema = z.object({
  projectId: idString,
  documentId: idString,
});

export async function POST(request: NextRequest) {
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
    const projectId = body.projectId;
    const documentId = body.documentId;

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) return apiError("מסמך לא נמצא", 404);

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(document.bucket)
      .download(document.path);

    if (error || !data) {
      return apiError(`לא ניתן להוריד את הקובץ: ${error?.message ?? "unknown"}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const parseResult = await AiDocumentParserService.parse<ParsedContractBoqResult>({
      documentType: "contract_boq",
      fileName: document.name,
      mimeType: "application/pdf",
      buffer,
      language: "he",
    });

    const parseLog = await AiParseRepository.create({
      documentType: "contract_boq",
      documentId,
      projectId,
      status: parseResult.success ? "success" : "failed",
      startedAt: new Date(parseResult.startedAt),
      endedAt: new Date(parseResult.endedAt),
      durationMs: parseResult.durationMs,
      itemsDetected: parseResult.itemsDetected,
      fieldsMissing: parseResult.missingFields.length,
      error: parseResult.error ?? undefined,
      resultJson: parseResult.data
        ? JSON.stringify(parseResult.data)
        : undefined,
      createdById: userId,
    });

    return apiSuccess({
      parseLogId: parseLog.id,
      success: parseResult.success,
      parsed: parseResult.data,
      missingFields: parseResult.missingFields,
      itemsDetected: parseResult.itemsDetected,
      error: parseResult.error ?? undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
