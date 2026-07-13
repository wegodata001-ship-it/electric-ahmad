import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import {
  uploadToStorage,
  resolveDocumentType,
  getBucketForDocumentType,
} from "@/lib/supabase/storage";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { GalleryRepository } from "@/repositories/gallery.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { StorageBucketKey } from "@/config/storage";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const uploadType = (formData.get("type") as string) ?? "document";
    const title = (formData.get("title") as string) ?? file?.name ?? "קובץ";
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

    if (uploadType === "image" || uploadType === "video") {
      const bucket: StorageBucketKey =
        bucketKey ?? (uploadType === "image" ? "images" : "videos");

      const uploaded = await uploadToStorage({
        file,
        fileName: file.name,
        mimeType,
        size: file.size,
        bucketKey: bucket,
        projectId,
        subfolder: uploadType === "image" ? "images" : "videos",
      });

      const gallery = await GalleryRepository.create(
        {
          projectId,
          type: uploadType === "image" ? "image" : "video",
          title,
          bucket: uploaded.bucket,
          path: uploaded.path,
          url: uploaded.url,
          thumbnailUrl: uploaded.url,
          thumbnailPath: uploaded.path,
          boqItemId,
          reportId,
          employeeId,
        },
        userId
      );

      return apiSuccess(gallery);
    }

    const bucket: StorageBucketKey =
      bucketKey ?? getBucketForDocumentType(docType);

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: bucket,
      projectId,
      subfolder: docType === "pdf" ? "pdf" : docType === "excel" ? "excel" : "documents",
    });

    const document = await DocumentsRepository.create(
      {
        projectId,
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

    if (entity === "gallery") {
      await GalleryRepository.delete(id, userId);
    } else {
      await DocumentsRepository.delete(id, userId);
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
