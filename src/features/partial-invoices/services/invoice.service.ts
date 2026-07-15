import type {
  PartialInvoice,
  Project,
  ProjectInvoiceApproval,
} from "@/types";
import { apiClient } from "@/lib/api/client";

export type CreateInvoicePayload = {
  projectId: string;
  date: string;
  dueDate?: string;
  billingMonth?: string;
  billTo?: string;
  contractor?: string;
  notes?: string;
  status?: string;
  items: { boqItemId: string; quantity: number }[];
};

export const invoiceService = {
  async getAll(): Promise<PartialInvoice[]> {
    return apiClient.get<PartialInvoice[]>("/api/partial-invoices");
  },

  async getByProject(projectId: string): Promise<PartialInvoice[]> {
    return apiClient.get<PartialInvoice[]>(
      `/api/partial-invoices?projectId=${projectId}`
    );
  },

  async getById(id: string): Promise<PartialInvoice> {
    return apiClient.get<PartialInvoice>(`/api/partial-invoices/${id}`);
  },

  async getNextSequence(projectId: string): Promise<{
    sequenceNumber: number;
    billingMonth: string;
    displayLabel: string;
    project: Project;
  }> {
    return apiClient.get(
      `/api/partial-invoices/next-sequence?projectId=${projectId}`
    );
  },

  async create(payload: CreateInvoicePayload): Promise<PartialInvoice> {
    return apiClient.post<PartialInvoice>("/api/partial-invoices", payload);
  },

  async update(
    id: string,
    payload: {
      date?: string;
      dueDate?: string;
      billingMonth?: string;
      billTo?: string;
      contractor?: string;
      notes?: string;
      status?: string;
      items: {
        boqItemId: string;
        quantity: number;
        unitPrice?: number;
        description?: string;
        unit?: string;
      }[];
    }
  ): Promise<PartialInvoice> {
    return apiClient.patch<PartialInvoice>(
      `/api/partial-invoices/${id}`,
      payload
    );
  },

  async sendForApproval(invoiceId: string): Promise<ProjectInvoiceApproval> {
    return apiClient.post<ProjectInvoiceApproval>(
      `/api/partial-invoices/${invoiceId}/send-for-approval`
    );
  },

  async getApprovals(invoiceId: string): Promise<ProjectInvoiceApproval[]> {
    return apiClient.get<ProjectInvoiceApproval[]>(
      `/api/partial-invoices/${invoiceId}/approvals`
    );
  },

  async markSentToClient(invoiceId: string): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(
      `/api/partial-invoices/${invoiceId}/send-to-client`
    );
  },
};
