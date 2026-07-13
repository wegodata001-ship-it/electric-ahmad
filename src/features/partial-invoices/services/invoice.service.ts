import type { PartialInvoice } from "@/types";
import { apiClient } from "@/lib/api/client";

export const invoiceService = {
  async getAll(): Promise<PartialInvoice[]> {
    return apiClient.get<PartialInvoice[]>("/api/partial-invoices");
  },

  async getByProject(projectId: string): Promise<PartialInvoice[]> {
    return apiClient.get<PartialInvoice[]>(`/api/partial-invoices?projectId=${projectId}`);
  },

  async getById(id: string): Promise<PartialInvoice | undefined> {
    const invoices = await this.getAll();
    return invoices.find((i) => i.id === id);
  },
};
