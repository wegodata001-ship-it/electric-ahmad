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
  /** When set, only these execution reports are marked as invoiced. */
  reportIds?: string[];
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

  async sendForApproval(
    invoiceId: string,
    payload: {
      approverUserId?: string;
      approverUserIds?: string[];
      createTask?: boolean;
      notifyInApp?: boolean;
      sendWhatsApp?: boolean;
      sendEmail?: boolean;
    }
  ): Promise<{
    approval: ProjectInvoiceApproval;
    approvals?: ProjectInvoiceApproval[];
    channels: { whatsappUrl: string | null; emailUrl: string | null };
  }> {
    return apiClient.post(
      `/api/partial-invoices/${invoiceId}/send-for-approval`,
      payload
    );
  },

  async saveDocument(invoiceId: string): Promise<{
    document: { id: string; name: string; folderPath?: string | null; url: string };
    created: boolean;
  }> {
    return apiClient.post(`/api/partial-invoices/${invoiceId}/save-document`);
  },

  async listApprovers(): Promise<
    {
      id: string;
      fullName: string;
      role: string;
      roleLabel: string;
      department: string;
      phone: string;
      email: string;
      status: "active" | "inactive";
      statusLabel: string;
      pendingApprovals: number;
      employeeId: string | null;
    }[]
  > {
    const res = await apiClient.get<{ items: any[] }>(
      "/api/partial-invoices/approvers"
    );
    return res.items;
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
