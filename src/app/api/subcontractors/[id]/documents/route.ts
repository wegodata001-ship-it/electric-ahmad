import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { assertOfficeCanAccessSubcontractor } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";
import { uploadToStorage, createSignedStorageUrl } from "@/lib/supabase/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const items = await SubcontractorsRepository.listDocuments(id);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("לא נבחר קובץ");
    const isImage = file.type.startsWith("image/");
    if (!isImage && file.type !== "application/pdf") {
      return apiError("ניתן להעלות PDF או תמונה בלבד");
    }
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bucketKey: isImage ? "images" : "documents",
      projectId: "subcontractors",
      subfolder: id,
    });
    const doc = await SubcontractorsRepository.addDocument(
      {
        subcontractorId: id,
        category: String(form.get("category") || "other"),
        title: String(form.get("title") || file.name),
        bucket: uploaded.bucket,
        path: uploaded.path,
        mimeType: file.type,
        sizeBytes: file.size,
      },
      session.userId
    );
    const url = await createSignedStorageUrl(uploaded.bucket, uploaded.path);
    return apiSuccess({ id: doc.id, url });
  } catch (error) {
    return handleApiError(error);
  }
}
