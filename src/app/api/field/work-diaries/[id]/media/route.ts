import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;

    const diary = await WorkDiariesRepository.getById(id);
    if (!diary || diary.foremanId !== session.foremanId) {
      return apiError("יומן לא נמצא", 404);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    const stage = form.get("stage") ? String(form.get("stage")) : "other";

    const isImage = (file.type || "").startsWith("image/");
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || (isImage ? "image/jpeg" : "application/octet-stream"),
      size: file.size,
      bucketKey: isImage ? "images" : "documents",
      projectId: diary.projectId,
      subfolder: `work-diaries/${id}`,
    });

    if (isImage) {
      const media = await WorkDiariesRepository.addMedia(
        id,
        {
          name: file.name,
          url: uploaded.url,
          path: uploaded.path,
          bucket: uploaded.bucket,
          size: uploaded.size,
          stage,
        },
        session.userId
      );
      return apiSuccess(media, 201);
    }

    const attachment = await WorkDiariesRepository.addAttachment(
      id,
      {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: uploaded.size,
        kind: "document",
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
      },
      session.userId
    );
    return apiSuccess(attachment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
