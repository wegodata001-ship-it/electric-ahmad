import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const diary = await WorkDiariesRepository.getById(id);
    if (!diary) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, diary, "edit_draft");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    const isImage = file.type.startsWith("image/");
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bucketKey: isImage ? "images" : "documents",
      projectId: diary.projectId,
      subfolder: `work-diaries/${id}`,
    });
    const result = isImage
      ? await WorkDiariesRepository.addMedia(
          id,
          {
            name: file.name,
            url: uploaded.url,
            path: uploaded.path,
            bucket: uploaded.bucket,
            size: uploaded.size,
            stage: String(form.get("stage") || "other"),
          },
          session.userId
        )
      : await WorkDiariesRepository.addAttachment(
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
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
