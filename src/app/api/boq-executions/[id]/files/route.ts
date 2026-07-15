import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { BoqExecutionsRepository } from "@/repositories/boq-executions.repository";
import { uploadToStorage, resolveDocumentType } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();
    const { id } = await params;
    const execution = await BoqExecutionsRepository.findById(id);
    if (!execution) return apiError("דיווח לא נמצא", 404);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("קובץ חובה");

    const mimeType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docType = resolveDocumentType(mimeType, extension);

    if (docType === "image" || docType === "video") {
      const uploaded = await uploadToStorage({
        file,
        fileName: file.name,
        mimeType,
        size: file.size,
        bucketKey: docType === "image" ? "images" : "videos",
        projectId: execution.projectId,
        subfolder: "boq-executions",
      });

      const media = await BoqExecutionsRepository.addMedia(id, {
        type: docType,
        name: file.name,
        extension,
        size: file.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
        thumbnailUrl: uploaded.url,
      });
      return apiSuccess(media, 201);
    }

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: docType === "pdf" ? "pdf" : "documents",
      projectId: execution.projectId,
      subfolder: "boq-executions",
    });

    const attachment = await BoqExecutionsRepository.addAttachment(id, {
      name: file.name,
      mimeType,
      size: file.size,
      kind: docType === "pdf" ? "pdf" : "document",
      bucket: uploaded.bucket,
      path: uploaded.path,
      url: uploaded.url,
    });

    return apiSuccess(attachment, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
