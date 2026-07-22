import { apiClient } from "@/lib/api/client";
import type { Document } from "@/types";
import type { StorageBucketKey } from "@/config/storage";

export interface UploadFileParams {
  file: File;
  projectId: string;
  type?: "document" | "image" | "video";
  title?: string;
  folderPath?: string;
  /** אם מוגדר — הקובץ מצורף למסמך קיים במקום יצירת מסמך חדש */
  documentId?: string;
  boqItemId?: string;
  reportId?: string;
  employeeId?: string;
  bucketKey?: StorageBucketKey;
}

export const uploadService = {
  async uploadFile(params: UploadFileParams): Promise<Document> {
    const formData = new FormData();
    formData.append("file", params.file);
    formData.append("projectId", params.projectId);
    if (params.type) formData.append("type", params.type);
    if (params.title) formData.append("title", params.title);
    if (params.folderPath) formData.append("folderPath", params.folderPath);
    if (params.documentId) formData.append("documentId", params.documentId);
    if (params.boqItemId) formData.append("boqItemId", params.boqItemId);
    if (params.reportId) formData.append("reportId", params.reportId);
    if (params.employeeId) formData.append("employeeId", params.employeeId);
    if (params.bucketKey) formData.append("bucketKey", params.bucketKey);

    return apiClient.upload<Document>("/api/upload", formData);
  },

  async deleteFile(
    id: string,
    entity: "document" | "attachment" = "document"
  ): Promise<void> {
    await apiClient.delete(`/api/upload?id=${id}&entity=${entity}`);
  },
};
