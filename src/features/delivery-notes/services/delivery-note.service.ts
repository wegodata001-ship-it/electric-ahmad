import type { DeliveryNote, DeliveryNoteAttachment } from "@/types";
import { apiClient } from "@/lib/api/client";

export type CreateDeliveryNotePayload = {
  date: string;
  departureTime?: string;
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
  driverName?: string;
  vehicle?: string;
  vehicleNumber?: string;
  externalCarrier?: boolean;
  deliveryTime?: string;
  destination?: string;
  destinationAddress?: string;
  driverNotes?: string;
  senderSigned?: boolean;
  receiverSigned?: boolean;
  receiverName?: string;
  receivedAt?: string | null;
  equipmentCheckedIntact?: boolean;
  receivedComplete?: boolean;
  receivedWithNotes?: boolean;
  receiptNotes?: string;
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

  async getById(id: string): Promise<DeliveryNote> {
    return apiClient.get<DeliveryNote>(`/api/delivery-notes/${id}`);
  },

  async getNextNumber(): Promise<{ sequenceNumber: number; noteNumber: string }> {
    return apiClient.get("/api/delivery-notes/next-sequence");
  },

  async create(payload: CreateDeliveryNotePayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>("/api/delivery-notes", payload);
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
};
