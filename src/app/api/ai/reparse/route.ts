import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AiDocumentParserService } from "@/lib/ai/document-parser.service";
import type { ParsedContractBoqResult } from "@/lib/ai/types";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();
    const projectId = String(body.projectId ?? "");
    const documentId = String(body.documentId ?? "");

    if (!projectId || !documentId) {
      return apiError("מזהה פרויקט ומסמך נדרשים");
    }

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
