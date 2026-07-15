import { apiClient } from "@/lib/api/client";
import type {
  WorkOrder,
  WorkOrderCounts,
  WorkOrderStatus,
  WorkOrderVehicle,
  WorkOrderWorker,
} from "../types";

export type WorkOrderSavePayload = {
  projectId: string;
  date?: string;
  title?: string;
  workArea?: string;
  clientName?: string;
  address?: string;
  notes?: string;
  status?: WorkOrderStatus;
  workers?: WorkOrderWorker[];
  vehicles?: WorkOrderVehicle[];
};

export const workManagementService = {
  list(status?: WorkOrderStatus) {
    const q = status ? `?status=${status}` : "";
    return apiClient.get<{ items: WorkOrder[]; counts: WorkOrderCounts }>(
      `/api/field/work-orders${q}`
    );
  },

  getById(id: string) {
    return apiClient.get<WorkOrder>(`/api/field/work-orders/${id}`);
  },

  create(payload: WorkOrderSavePayload) {
    return apiClient.post<WorkOrder>("/api/field/work-orders", payload);
  },

  update(id: string, payload: Partial<WorkOrderSavePayload>) {
    return apiClient.patch<WorkOrder>(`/api/field/work-orders/${id}`, payload);
  },

  setStatus(id: string, status: WorkOrderStatus) {
    return apiClient.post<WorkOrder>(`/api/field/work-orders/${id}/status`, {
      status,
    });
  },

  remove(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/api/field/work-orders/${id}`);
  },

  async uploadMedia(id: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiClient.upload<WorkOrder["media"][number]>(
      `/api/field/work-orders/${id}/media`,
      form
    );
  },
};
