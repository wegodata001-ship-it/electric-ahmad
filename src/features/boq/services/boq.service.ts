import type { BoqItem, BoqItemKind, BoqItemStatus } from "@/types";
import { apiClient } from "@/lib/api/client";

export type BoqItemPayload = {
  projectId?: string;
  code?: string | null;
  description: string;
  unit?: string;
  contractQuantity: number;
  unitPrice: number;
  category?: string | null;
  notes?: string | null;
  itemKind?: BoqItemKind;
  status?: BoqItemStatus;
};

export const boqService = {
  async getAll(): Promise<BoqItem[]> {
    return apiClient.get<BoqItem[]>("/api/boq");
  },

  async getByProject(projectId: string): Promise<BoqItem[]> {
    return apiClient.get<BoqItem[]>(`/api/boq?projectId=${projectId}`);
  },

  async getById(id: string): Promise<BoqItem> {
    return apiClient.get<BoqItem>(`/api/boq/${id}`);
  },

  async create(body: BoqItemPayload): Promise<BoqItem> {
    return apiClient.post<BoqItem>("/api/boq", body);
  },

  async update(id: string, body: Partial<BoqItemPayload>): Promise<BoqItem> {
    return apiClient.patch<BoqItem>(`/api/boq/${id}`, body);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/boq/${id}`);
  },

  async getHistory(id: string) {
    return apiClient.get<{
      item: BoqItem;
      history: {
        id: string;
        action: string;
        createdAt: string;
        user: { id: string; name: string };
        metadata: unknown;
      }[];
    }>(`/api/boq/${id}/history`);
  },
};
