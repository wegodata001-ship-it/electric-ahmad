import type { Document } from "@/types";
import { apiClient } from "@/lib/api/client";

export const documentService = {
  async getAll(): Promise<Document[]> {
    return apiClient.get<Document[]>("/api/documents");
  },

  async getByProject(projectId: string): Promise<Document[]> {
    return apiClient.get<Document[]>(`/api/documents?projectId=${projectId}`);
  },

  async getById(id: string): Promise<Document | undefined> {
    const docs = await this.getAll();
    return docs.find((d) => d.id === id);
  },

  async getRecent(limit = 5): Promise<Document[]> {
    return apiClient.get<Document[]>(`/api/documents?recent=${limit}`);
  },
};
