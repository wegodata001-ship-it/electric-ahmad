import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { AiDocumentParserService } from "@/lib/ai/document-parser.service";
import type { ParsedContractBoqResult } from "@/lib/ai/types";
import { getAuthContext } from "@/lib/auth/session";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PipelineError, pipelineLog } from "@/lib/api/pipeline-log";

export const maxDuration = 300;

function draftNameFromFile(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "פרויקט חדש";
}

export async function POST(request: NextRequest) {
  let currentStep = "init";

  try {
    // ── auth ──────────────────────────────────────────────────────────────
    currentStep = "auth";
    const { userId } = await getAuthContext();

    // ── UPLOAD: receive file ──────────────────────────────────────────────
    currentStep = "receive_file";
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new PipelineError("UPLOAD", "receive_file", "יש להעלות קובץ PDF");
    }

    const mimeType = file.type || "application/pdf";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (mimeType !== "application/pdf" && extension !== "pdf") {
      throw new PipelineError("UPLOAD", "validate_file", "ניתן להעלות קובץ PDF בלבד");
    }

    pipelineLog("UPLOAD", "PDF received", {
      name: file.name,
      size: file.size,
      mimeType,
    });

    const draftName = draftNameFromFile(file.name);
    const draftContractNumber = `DRAFT-${Date.now()}`;

    // ── DATABASE: create draft project ────────────────────────────────────
    currentStep = "create_draft_project";
    pipelineLog("DATABASE", "Creating draft Project...");
    const project = await ProjectsRepository.create(
      {
        name: draftName,
        contractNumber: draftContractNumber,
        contractor: "ממתין לזיהוי",
        location: "ממתין לזיהוי",
        foremanName: "מנהל עבודה",
        contractValue: 1,
        description: "טיוטה — ממתין לניתוח Gemini",
        status: "planning",
      },
      userId
    );
    pipelineLog("DATABASE", "Draft Project created", { projectId: project.id });

    // ── STORAGE: upload PDF ───────────────────────────────────────────────
    currentStep = "storage_upload";
    pipelineLog("STORAGE", "Saving PDF to Supabase Storage...");
    let uploaded;
    try {
      uploaded = await uploadToStorage({
        file,
        fileName: file.name,
        mimeType: "application/pdf",
        size: file.size,
        bucketKey: "pdf",
        projectId: project.id,
        subfolder: "contracts",
      });
    } catch (error) {
      throw new PipelineError(
        "STORAGE",
        "storage_upload",
        error instanceof Error ? error.message : "שגיאה בשמירת הקובץ",
        error
      );
    }
    pipelineLog("STORAGE", "Saved successfully", {
      bucket: uploaded.bucket,
      path: uploaded.path,
    });

    // ── DATABASE: create Document ─────────────────────────────────────────
    currentStep = "create_document";
    pipelineLog("DATABASE", "Creating Document record...");
    const document = await DocumentsRepository.create(
      {
        projectId: project.id,
        name: file.name.replace(/\.pdf$/i, "") || draftName,
        type: "pdf",
        extension: "pdf",
        size: uploaded.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
      },
      userId
    );
    pipelineLog("DATABASE", "Document created", { documentId: document.id });

    // ── AI: Gemini parsing ────────────────────────────────────────────────
    currentStep = "gemini_parse";
    pipelineLog("AI", "Gemini parsing started");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await AiDocumentParserService.parse<ParsedContractBoqResult>({
      documentType: "contract_boq",
      fileName: file.name,
      mimeType: "application/pdf",
      buffer,
      language: "he",
    });

    if (parseResult.success) {
      pipelineLog("AI", "Gemini parsing completed", {
        itemsDetected: parseResult.itemsDetected,
        missingFields: parseResult.missingFields.length,
        durationMs: parseResult.durationMs,
      });
      pipelineLog("AI", "JSON received from Gemini");
    } else {
      pipelineLog("AI", "Gemini parsing failed", { error: parseResult.error });
    }

    // ── DATABASE: create AI Parse Log ─────────────────────────────────────
    currentStep = "create_ai_parse_log";
    pipelineLog("DATABASE", "Creating AI Parse Log...");
    const parseLog = await AiParseRepository.create({
      documentType: "contract_boq",
      documentId: document.id,
      projectId: project.id,
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
    pipelineLog("DATABASE", "AI Parse Log created", { parseLogId: parseLog.id });

    // ── DATABASE: prefill project from AI ─────────────────────────────────
    currentStep = "prefill_project";
    if (parseResult.success && parseResult.data?.project) {
      const p = parseResult.data.project;
      const nextContract =
        p.contractNumber?.trim() && p.contractNumber.trim() !== draftContractNumber
          ? p.contractNumber.trim()
          : draftContractNumber;

      pipelineLog("DATABASE", "Prefilling Project from Gemini JSON...");
      try {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            name: p.name?.trim() || project.name,
            contractNumber: nextContract,
            contractor: p.contractor?.trim() || project.contractor,
            location: p.location?.trim() || project.location,
            contractValue:
              p.contractValue && p.contractValue > 0 ? p.contractValue : 1,
            description:
              [
                p.client ? `לקוח: ${p.client}` : null,
                p.paymentTerms ? `תשלום: ${p.paymentTerms}` : null,
                p.currency ? `מטבע: ${p.currency}` : null,
                p.notes,
              ]
                .filter(Boolean)
                .join("\n") || project.description,
            updatedById: userId,
          },
        });
      } catch {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            name: p.name?.trim() || project.name,
            contractor: p.contractor?.trim() || project.contractor,
            location: p.location?.trim() || project.location,
            contractValue:
              p.contractValue && p.contractValue > 0 ? p.contractValue : 1,
            updatedById: userId,
          },
        });
      }
      pipelineLog("DATABASE", "Project prefilled");
    }

    // ── RESPONSE ──────────────────────────────────────────────────────────
    currentStep = "response";
    pipelineLog("RESPONSE", "Returning parse result to client");

    return apiSuccess({
      projectId: project.id,
      documentId: document.id,
      parseLogId: parseLog.id,
      success: parseResult.success,
      parsed: parseResult.data,
      missingFields: parseResult.missingFields,
      itemsDetected: parseResult.itemsDetected,
      durationMs: parseResult.durationMs,
      error: parseResult.error,
      message: parseResult.success
        ? "המסמך נותח בהצלחה. יש לעבור למסך Review."
        : "הקובץ נשמר, אך לא הצלחנו לזהות את כל הנתונים.",
      pipeline: {
        uploaded: true,
        storageSaved: true,
        documentCreated: true,
        aiCompleted: parseResult.success,
        parseLogCreated: true,
        projectCreated: true,
      },
    });
  } catch (error) {
    if (error instanceof PipelineError) {
      pipelineLog("ERROR", `Failed at step ${error.step}`, error.message);
      return apiError(error.message, 500);
    }

    pipelineLog("ERROR", `Failed at step ${currentStep}`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}
