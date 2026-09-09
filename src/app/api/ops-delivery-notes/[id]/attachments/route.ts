import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const note = await OpsDeliveryNotesRepository.getById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, note, "edit_draft");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bucketKey: file.type.startsWith("image/") ? "images" : "documents",
      projectId: note.projectId || undefined,
      subfolder: `ops-delivery-notes/${id}`,
    });
    const media = await OpsDeliveryNotesRepository.addMedia(id, {
      name: file.name,
      url: uploaded.url,
      path: uploaded.path,
      bucket: uploaded.bucket,
      size: uploaded.size,
      stage: String(form.get("stage") || "other"),
    });
    return apiSuccess(media, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
