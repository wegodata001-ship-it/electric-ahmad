import type { Document, DocumentAttachment } from "@/types";
import { apiClient } from "@/lib/api/client";

export const documentService = {
  async getAll(): Promise<Document[]> {
    return apiClient.get<Document[]>("/api/documents");
  },

  async getByProject(projectId: string): Promise<Document[]> {
    return apiClient.get<Document[]>(`/api/documents?projectId=${projectId}`);
  },

  async getById(id: string): Promise<Document> {
    return apiClient.get<Document>(`/api/documents/${id}`);
  },

  async getRecent(limit = 5): Promise<Document[]> {
    return apiClient.get<Document[]>(`/api/documents?recent=${limit}`);
  },

  async search(query: string, projectId?: string): Promise<Document[]> {
    const params = new URLSearchParams({ q: query });
    if (projectId) params.set("projectId", projectId);
    return apiClient.get<Document[]>(`/api/documents?${params}`);
  },

  async migrateGallery(): Promise<{ total: number; created: number; skipped: number }> {
    return apiClient.get(`/api/documents?migrateGallery=1`);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/documents/${id}`);
  },

  async uploadAttachment(documentId: string, file: File, title?: string): Promise<Document> {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    return apiClient.upload<Document>(
      `/api/documents/${documentId}/attachments`,
      formData
    );
  },

  async deleteAttachment(attachmentId: string): Promise<Document> {
    return apiClient.delete(`/api/upload?id=${attachmentId}&entity=attachment`);
  },
};

export type { DocumentAttachment };
