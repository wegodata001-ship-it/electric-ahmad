import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import {
  uploadToStorage,
  resolveDocumentType,
  getBucketForDocumentType,
} from "@/lib/supabase/storage";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { defaultFolderForDocumentType } from "@/lib/documents/archive-folders";
import type { StorageBucketKey } from "@/config/storage";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const uploadType = (formData.get("type") as string) ?? "document";
    const title = (formData.get("title") as string) ?? file?.name ?? "קובץ";
    const folderPathRaw = formData.get("folderPath") as string | null;
    const documentId = (formData.get("documentId") as string) ?? undefined;
    const boqItemId = (formData.get("boqItemId") as string) ?? undefined;
    const reportId = (formData.get("reportId") as string) ?? undefined;
    const employeeId = (formData.get("employeeId") as string) ?? undefined;
    const bucketKey = (formData.get("bucketKey") as StorageBucketKey) ?? undefined;

    if (!file || !projectId) {
      return apiError("קובץ ומזהה פרויקט נדרשים");
    }

    const mimeType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docType = resolveDocumentType(mimeType, extension);

    const isMedia = uploadType === "image" || uploadType === "video";
    const resolvedType = isMedia
      ? uploadType === "video"
        ? "video"
        : "image"
      : docType;

    const bucket: StorageBucketKey =
      bucketKey ??
      (resolvedType === "image"
        ? "images"
        : resolvedType === "video"
          ? "videos"
          : getBucketForDocumentType(resolvedType));

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: bucket,
      projectId,
      subfolder:
        resolvedType === "image"
          ? "images"
          : resolvedType === "video"
            ? "videos"
            : resolvedType === "pdf"
              ? "pdf"
              : resolvedType === "excel"
                ? "excel"
                : "documents",
    });

    /** העלאה כקובץ מצורף למסמך קיים */
    if (documentId) {
      const updated = await DocumentsRepository.addAttachment(
        documentId,
        {
          name: title,
          type: resolvedType,
          extension: uploaded.extension,
          size: uploaded.size,
          bucket: uploaded.bucket,
          path: uploaded.path,
          url: uploaded.url,
        },
        userId
      );
      return apiSuccess(updated);
    }

    const folderPath =
      folderPathRaw?.trim() ||
      defaultFolderForDocumentType(resolvedType);

    const document = await DocumentsRepository.create(
      {
        projectId,
        name: title,
        type: resolvedType,
        extension: uploaded.extension,
        size: uploaded.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
        folderPath,
        boqItemId: boqItemId ?? null,
        reportId: reportId ?? null,
        employeeId: employeeId ?? null,
      },
      userId
    );

    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    const entity = searchParams.get("entity") ?? "document";

    if (!id) return apiError("מזהה נדרש");

    if (entity === "attachment") {
      const doc = await DocumentsRepository.deleteAttachment(id, userId);
      return apiSuccess(doc);
    }

    // gallery entity ממופה גם למסמך (תאימות לאחור)
    await DocumentsRepository.delete(id, userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
