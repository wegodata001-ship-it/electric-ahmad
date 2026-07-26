import type { BoqItem, BoqItemKind, BoqItemStatus } from "@/types";
import { apiClient } from "@/lib/api/client";
import type { ListPageInfo } from "@/lib/api/list-query";

export type BoqListPage = {
  items: BoqItem[];
  total: number;
  pageInfo: ListPageInfo;
};

export type BoqListPageParams = {
  projectId?: string;
  q?: string;
  itemKind?: BoqItemKind | "all";
  status?: BoqItemStatus | "all";
  sort?: "code" | "updatedAt" | "contractQuantity";
  dir?: "asc" | "desc";
  take?: number;
  skip?: number;
  page?: number;
};

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

  /** Paged BOQ list (P5). */
  async listPage(params: BoqListPageParams = {}): Promise<BoqListPage> {
    const sp = new URLSearchParams();
    if (params.projectId) sp.set("projectId", params.projectId);
    if (params.q) sp.set("q", params.q);
    if (params.itemKind && params.itemKind !== "all") {
      sp.set("itemKind", params.itemKind);
    }
    if (params.status && params.status !== "all") {
      sp.set("status", params.status);
    }
    if (params.sort) sp.set("sort", params.sort);
    if (params.dir) sp.set("dir", params.dir);
    if (params.take != null) sp.set("take", String(params.take));
    if (params.skip != null) sp.set("skip", String(params.skip));
    if (params.page != null) sp.set("page", String(params.page));
    const qs = sp.toString();
    return apiClient.get<BoqListPage>(`/api/boq${qs ? `?${qs}` : ""}`);
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
