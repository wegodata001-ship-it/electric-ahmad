import type { Client } from "@/types";
import { apiClient } from "@/lib/api/client";

export type CreateClientPayload = {
  name: string;
  clientNumber?: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  phoneSecondary?: string;
  address?: string;
  city?: string;
  email?: string;
  notes?: string;
};

export const clientService = {
  async getAll(query?: string): Promise<Client[]> {
    const q = query?.trim()
      ? `?q=${encodeURIComponent(query.trim())}`
      : "";
    return apiClient.get<Client[]>(`/api/clients${q}`);
  },

  async getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`/api/clients/${id}`);
  },

  async create(payload: CreateClientPayload): Promise<Client> {
    return apiClient.post<Client>("/api/clients", payload);
  },

  async update(id: string, payload: Partial<CreateClientPayload>): Promise<Client> {
    return apiClient.patch<Client>(`/api/clients/${id}`, payload);
  },
};
