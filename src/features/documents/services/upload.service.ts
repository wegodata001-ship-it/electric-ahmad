import { apiClient } from "@/lib/api/client";
import type { Document, GalleryItem } from "@/types";
import type { StorageBucketKey } from "@/config/storage";

export interface UploadFileParams {
  file: File;
  projectId: string;
  type?: "document" | "image" | "video";
  title?: string;
  boqItemId?: string;
  reportId?: string;
  employeeId?: string;
  bucketKey?: StorageBucketKey;
}

export const uploadService = {
  async uploadFile(params: UploadFileParams): Promise<Document | GalleryItem> {
    const formData = new FormData();
    formData.append("file", params.file);
    formData.append("projectId", params.projectId);
    if (params.type) formData.append("type", params.type);
    if (params.title) formData.append("title", params.title);
    if (params.boqItemId) formData.append("boqItemId", params.boqItemId);
    if (params.reportId) formData.append("reportId", params.reportId);
    if (params.employeeId) formData.append("employeeId", params.employeeId);
    if (params.bucketKey) formData.append("bucketKey", params.bucketKey);

    return apiClient.upload<Document | GalleryItem>("/api/upload", formData);
  },

  async deleteFile(id: string, entity: "document" | "gallery" = "document"): Promise<void> {
    await apiClient.delete(`/api/upload?id=${id}&entity=${entity}`);
  },
};
