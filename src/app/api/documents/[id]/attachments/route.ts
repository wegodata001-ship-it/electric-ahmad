import { NextRequest } from "next/server";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import {
  uploadToStorage,
  resolveDocumentType,
  getBucketForDocumentType,
} from "@/lib/supabase/storage";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { StorageBucketKey } from "@/config/storage";

type Ctx = { params: Promise<{ id: string }> };

/** העלאת קובץ מצורף למסמך */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) ?? file?.name ?? "קובץ";

    if (!file) return apiError("קובץ נדרש");

    const doc = await DocumentsRepository.findById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);
    const { userId } = await requireProjectPermission(
      "edit_draft",
      doc.projectId
    );

    const mimeType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docType = resolveDocumentType(mimeType, extension);
    const bucket: StorageBucketKey =
      docType === "image"
        ? "images"
        : docType === "video"
          ? "videos"
          : getBucketForDocumentType(docType);

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: bucket,
      projectId: doc.projectId,
      subfolder: `attachments/${id}`,
    });

    const updated = await DocumentsRepository.addAttachment(
      id,
      {
        name: title,
        type: docType,
        extension: uploaded.extension,
        size: uploaded.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
      },
      userId
    );

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
