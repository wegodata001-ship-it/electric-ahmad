import { apiClient } from "@/lib/api/client";
import type { ManagedUserRole } from "@/lib/auth/roles";

export type ManagedUserStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";

export type ManagedUserProject = {
  id: string;
  name: string;
  contractNumber: string;
  assignmentType: "owner" | "foreman" | "member";
};

export type ManagedUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: ManagedUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  archivedAt: string | null;
  employee: {
    id: string;
    role: string;
    status: string;
    isDeleted: boolean;
  } | null;
  projects: ManagedUserProject[];
  businessReferenceCount: number;
  recentActions: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: string | null;
    createdAt: string;
  }>;
};

export type ManagedUserPayload = {
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: ManagedUserRole;
  projectIds: string[];
  allowNoProjects?: boolean;
};

export const systemUsersService = {
  list() {
    return apiClient.get<{ users: ManagedUser[] }>("/api/system/users");
  },
  create(payload: ManagedUserPayload & { password: string }) {
    return apiClient.post<{
      user: ManagedUser;
      temporaryCredentials: { username: string; password: string };
    }>("/api/system/users", payload);
  },
  update(id: string, payload: ManagedUserPayload) {
    return apiClient.patch<ManagedUser>(`/api/system/users/${id}`, payload);
  },
  setStatus(id: string, status: ManagedUserStatus) {
    return apiClient.post<ManagedUser>(`/api/system/users/${id}/status`, {
      status,
    });
  },
  deletePermanently(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/api/system/users/${id}`);
  },
  resetPassword(id: string, password: string) {
    return apiClient.post<{ ok: boolean; username: string | null }>(
      `/api/system/users/${id}/reset-password`,
      { password }
    );
  },
};
