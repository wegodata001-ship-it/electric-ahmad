import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { uploadToStorage, resolveDocumentType } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const journal = await WorkJournalsRepository.findById(id);
    if (!journal) return apiError("יומן לא נמצא", 404);
    if (journal.foremanId !== session.foremanId) {
      return apiError("אין הרשאה", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("קובץ חובה");

    const mimeType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docType = resolveDocumentType(mimeType, extension);
    if (docType !== "image" && docType !== "video") {
      return apiError("ניתן להעלות תמונות או סרטונים בלבד");
    }

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: docType === "image" ? "images" : "videos",
      projectId: journal.projectId,
      subfolder: "work-journals",
    });

    const media = await WorkJournalsRepository.addMedia(
      id,
      session.foremanId,
      {
        type: docType,
        name: file.name,
        extension,
        size: file.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
        thumbnailUrl: uploaded.url,
      }
    );

    return apiSuccess(media, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
