import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canSeeAllProjects } from "@/lib/auth/project-access";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PipelineError, pipelineLog } from "@/lib/api/pipeline-log";
import { SCAN_STATUS } from "@/lib/ai/scan-job";
import {
  PROJECT_ORIGINAL_FOLDER,
  PROJECT_ORIGINAL_SOURCE_TYPE,
} from "@/lib/documents/project-original";

export const maxDuration = 60;

function draftNameFromFile(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "פרויקט חדש";
}

export async function POST(request: NextRequest) {
  let currentStep = "init";

  try {
    currentStep = "auth";
    const session = await requireOfficeUser();
    if (!canSeeAllProjects(session.role)) {
      return apiError("אין הרשאה ליצירת פרויקט", 403);
    }
    const { userId } = session;

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

    const buffer = Buffer.from(await file.arrayBuffer());
    pipelineLog("UPLOAD", "PDF received", {
      name: file.name,
      size: buffer.length,
      mimeType,
    });

    const draftName = draftNameFromFile(file.name);
    const draftContractNumber = `DRAFT-${Date.now()}`;

    currentStep = "create_draft_project";
    const project = await ProjectsRepository.create(
      {
        name: draftName,
        contractNumber: draftContractNumber,
        contractor: "ממתין לזיהוי",
        location: "ממתין לזיהוי",
        foremanName: "מנהל עבודה",
        contractValue: 1,
        description: "טיוטה — ממתין לניתוח AI",
        status: "planning",
      },
      userId
    );

    currentStep = "storage_upload";
    let uploaded;
    try {
      uploaded = await uploadToStorage({
        file: buffer,
        fileName: file.name,
        mimeType: "application/pdf",
        size: buffer.length,
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

    currentStep = "create_document";
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
        folderPath: PROJECT_ORIGINAL_FOLDER,
        sourceType: PROJECT_ORIGINAL_SOURCE_TYPE,
      },
      userId
    );

    currentStep = "create_ai_parse_log";
    const parseLog = await AiParseRepository.create({
      documentType: "contract_boq",
      documentId: document.id,
      projectId: project.id,
      status: SCAN_STATUS.QUEUED,
      startedAt: new Date(),
      createdById: userId,
    });
    pipelineLog("DATABASE", "Scan job queued", { parseLogId: parseLog.id });

    return apiSuccess({
      projectId: project.id,
      documentId: document.id,
      parseLogId: parseLog.id,
      pending: true,
      success: false,
      status: SCAN_STATUS.QUEUED,
      parsed: null,
      missingFields: [],
      itemsDetected: 0,
      message: "הקובץ נשמר. הסריקה ממתינה לעיבוד בשרת.",
      pipeline: {
        uploaded: true,
        storageSaved: true,
        documentCreated: true,
        aiCompleted: false,
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
