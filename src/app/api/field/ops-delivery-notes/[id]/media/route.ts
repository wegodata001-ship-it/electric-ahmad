import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;
    const note = await OpsDeliveryNotesRepository.getById(id);
    if (!note || note.foremanId !== session.foremanId) {
      return apiError("תעודה לא נמצאה", 404);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    const stage = form.get("stage") ? String(form.get("stage")) : "other";

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      size: file.size,
      bucketKey: "images",
      projectId: note.projectId || undefined,
      subfolder: `ops-delivery-notes/${id}`,
    });

    const media = await OpsDeliveryNotesRepository.addMedia(id, {
      name: file.name,
      url: uploaded.url,
      path: uploaded.path,
      bucket: uploaded.bucket,
      size: uploaded.size,
      stage,
    });

    return apiSuccess(media, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
