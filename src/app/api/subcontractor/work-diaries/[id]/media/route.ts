import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { prisma } from "@/lib/prisma";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { uploadToStorage } from "@/lib/supabase/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    const diary = await prisma.workDiary.findFirst({
      where: {
        id,
        deletedAt: null,
        subcontractorId: session.subcontractorId,
      },
      select: { id: true, projectId: true },
    });
    if (!diary) return apiError("יומן לא נמצא", 404);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    if (!file.type.startsWith("image/")) return apiError("ניתן להעלות תמונה בלבד");
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      bucketKey: "images",
      projectId: diary.projectId,
      subfolder: `work-diaries/${id}`,
    });
    const media = await WorkDiariesRepository.addMedia(
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
    );
    return apiSuccess(media);
  } catch (error) {
    return handleApiError(error);
  }
}
