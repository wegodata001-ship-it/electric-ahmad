import type { BoqItem } from "@/types";
import { apiClient } from "@/lib/api/client";

export const boqService = {
  async getAll(): Promise<BoqItem[]> {
    return apiClient.get<BoqItem[]>("/api/boq");
  },

  async getByProject(projectId: string): Promise<BoqItem[]> {
    return apiClient.get<BoqItem[]>(`/api/boq?projectId=${projectId}`);
  },

  async getById(id: string): Promise<BoqItem | undefined> {
    const items = await this.getAll();
    return items.find((b) => b.id === id);
  },

  async getReportsForItem(itemId: string) {
    return apiClient.get(`/api/reports?boqItemId=${itemId}`);
  },
};
