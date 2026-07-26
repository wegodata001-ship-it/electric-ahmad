import type {
  DeliveryNote,
  DeliveryNoteAttachment,
  DeliveryNoteVersion,
} from "@/types";
import { apiClient } from "@/lib/api/client";
import type { ListPageInfo } from "@/lib/api/list-query";

export type DeliveryNoteListItem = Pick<
  DeliveryNote,
  | "id"
  | "noteNumber"
  | "sequenceNumber"
  | "status"
  | "date"
  | "client"
  | "clientId"
  | "projectId"
  | "projectName"
  | "orderNumber"
  | "contactName"
  | "phone"
  | "phoneSecondary"
  | "city"
  | "receiverSigned"
  | "receiverSignatureUrl"
  | "currentVersion"
  | "createdAt"
  | "updatedAt"
> & {
  items: { quantity: number }[];
};

export type DeliveryNoteListPage = {
  items: DeliveryNoteListItem[];
  total: number;
  pageInfo: ListPageInfo;
};

export type DeliveryNoteListPageParams = {
  projectId?: string;
  q?: string;
  status?: string;
  take?: number;
  skip?: number;
  page?: number;
  sort?: "date" | "updatedAt" | "createdAt" | "noteNumber";
  dir?: "asc" | "desc";
};

export type CreateDeliveryNotePayload = {
  noteNumber?: string;
  date: string;
  status?: "draft" | "sent" | "delivered" | "cancelled" | "issued" | "in_transit" | "locked";
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  orderNumber?: string;
  contactName?: string;
  phone?: string;
  phoneSecondary?: string;
  address?: string;
  city?: string;
  notes?: string;
  receiverName?: string;
  receivedAt?: string;
  receiverSignatureUrl?: string | null;
  employeeSignatureUrl?: string | null;
  employeeSignedName?: string | null;
  senderSigned?: boolean;
  receiverSigned?: boolean;
  driverName?: string;
  driverPhone?: string;
  vehicle?: string;
  vehicleNumber?: string;
  externalCarrier?: boolean;
  deliveryTime?: string;
  destination?: string;
  destinationAddress?: string;
  driverNotes?: string;
  items: {
    sku?: string;
    description: string;
    unit: string;
    quantity: number;
    packageNumber?: string;
    serialNumber?: string;
    notes?: string;
  }[];
};

export const deliveryNoteService = {
  async getAll(): Promise<DeliveryNote[]> {
    return apiClient.get<DeliveryNote[]>("/api/delivery-notes");
  },

  async getByProject(projectId: string): Promise<DeliveryNote[]> {
    return apiClient.get<DeliveryNote[]>(
      `/api/delivery-notes?projectId=${projectId}`
    );
  },

  /** Paged list (P5). Server returns { items, total, pageInfo }. */
  async listPage(
    params: DeliveryNoteListPageParams = {}
  ): Promise<DeliveryNoteListPage> {
    const sp = new URLSearchParams();
    if (params.projectId) sp.set("projectId", params.projectId);
    if (params.q) sp.set("q", params.q);
    if (params.status && params.status !== "all") sp.set("status", params.status);
    if (params.take != null) sp.set("take", String(params.take));
    if (params.skip != null) sp.set("skip", String(params.skip));
    if (params.page != null) sp.set("page", String(params.page));
    if (params.sort) sp.set("sort", params.sort);
    if (params.dir) sp.set("dir", params.dir);
    const qs = sp.toString();
    return apiClient.get<DeliveryNoteListPage>(
      `/api/delivery-notes${qs ? `?${qs}` : ""}`
    );
  },

  async getById(id: string): Promise<DeliveryNote> {
    return apiClient.get<DeliveryNote>(`/api/delivery-notes/${id}`);
  },

  async getNextNumber(): Promise<{ sequenceNumber: number; noteNumber: string }> {
    return apiClient.get("/api/delivery-notes/next-sequence");
  },

  async create(payload: CreateDeliveryNotePayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>("/api/delivery-notes", payload);
  },

  async update(
    id: string,
    payload: CreateDeliveryNotePayload
  ): Promise<DeliveryNote> {
    return apiClient.patch<DeliveryNote>(`/api/delivery-notes/${id}`, payload);
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(`/api/delivery-notes/${id}`);
  },

  async complete(id: string): Promise<{
    note: DeliveryNote;
    document: { name: string; folderPath?: string | null; url: string };
  }> {
    return apiClient.post(`/api/delivery-notes/${id}/complete`);
  },

  async saveDocument(id: string): Promise<{
    document: { id: string; name: string; folderPath?: string | null; url: string };
    created: boolean;
  }> {
    return apiClient.post(`/api/delivery-notes/${id}/save-document`);
  },

  async listRecipients(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : "";
    return apiClient.get<{
      items: {
        id: string;
        kind: "user";
        fullName: string;
        roleLabel: string;
        phone: string;
        email: string;
        status: "active" | "inactive";
      }[];
    }>(`/api/delivery-notes/recipients${q}`);
  },

  async send(
    id: string,
    payload: {
      recipientIds: string[];
      includeClient?: boolean;
      notifyInApp?: boolean;
      sendWhatsApp?: boolean;
      sendEmail?: boolean;
    }
  ) {
    return apiClient.post<{
      note: DeliveryNote;
      channels: { whatsappUrl: string | null; emailUrl: string | null };
    }>(`/api/delivery-notes/${id}/send`, payload);
  },

  async getVersions(id: string): Promise<DeliveryNoteVersion[]> {
    return apiClient.get<DeliveryNoteVersion[]>(
      `/api/delivery-notes/${id}/versions`
    );
  },

  async uploadAttachment(
    noteId: string,
    file: File
  ): Promise<DeliveryNoteAttachment> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<DeliveryNoteAttachment>(
      `/api/delivery-notes/${noteId}/attachments`,
      formData
    );
  },

  async deleteAttachment(
    noteId: string,
    attachmentId: string
  ): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(
      `/api/delivery-notes/${noteId}/attachments/${attachmentId}`
    );
  },
};
