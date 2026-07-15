import { apiClient } from "@/lib/api/client";
import type { ForemanSummary } from "@/types";

export type ForemanDetail = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  status: string;
  role: string;
  isDeleted: boolean;
  notes: string;
  username: string | null;
  userId: string | null;
  joinedAt: string;
  createdAt: string;
  stats: {
    journalsCount: number;
    reportsCount: number;
    activeCrew: number;
    hoursThisMonth: number;
    hoursThisYear: number;
    activeProjects: number;
  };
  projects: {
    id: string;
    name: string;
    location: string;
    status: string;
    contractNumber: string;
  }[];
  crew: {
    id: string;
    name: string;
    phone: string;
    profession: string;
    status: string;
    notes: string;
  }[];
  journals: {
    id: string;
    date: string;
    projectId: string;
    projectName: string;
    status: string;
    workArea: string | null;
    notes: string | null;
    submittedAt: string | null;
    workers: {
      name: string;
      profession?: string | null;
      startTime: string | null;
      endTime: string | null;
      totalHours: number;
      status?: string | null;
      note: string | null;
    }[];
    actionsPerformed?: string | null;
    exceptions?: string | null;
    equipment?: string | null;
    clientName?: string | null;
    address?: string | null;
    lines: {
      code: string;
      description: string;
      unit: string;
      quantity: number;
      note: string | null;
    }[];
    media: { id: string; type: string; url: string; name: string }[];
  }[];
  dailyReports: {
    id: string;
    projectName: string;
    date: string;
    status: string;
    submittedAt: string;
    workersCount: number;
    totalHours: number;
  }[];
  reports: {
    id: string;
    projectName: string;
    code: string;
    description: string;
    quantity: number;
    unit: string;
    notes: string | null;
    reportedAt: string;
  }[];
  media: {
    id: string;
    type: string;
    url: string;
    title: string;
    source: string;
    createdAt: string;
  }[];
  activities: {
    id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
    projectId: string;
  }[];
};

export const foremenService = {
  getAll() {
    return apiClient.get<ForemanSummary[]>("/api/foremen");
  },
  getById(id: string) {
    return apiClient.get<ForemanDetail>(`/api/foremen/${id}`);
  },
  create(body: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    username: string;
    password: string;
    projectIds?: string[];
  }) {
    return apiClient.post<{
      employeeId: string;
      userId: string;
      username: string;
      fullName: string;
      phone: string;
      role: string;
    }>("/api/foremen", body);
  },
  update(
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      status?: string;
      notes?: string;
      projectIds?: string[];
    }
  ) {
    return apiClient.patch<ForemanDetail>(`/api/foremen/${id}`, body);
  },
  activate(id: string) {
    return apiClient.patch<ForemanDetail>(`/api/foremen/${id}`, {
      action: "activate",
    });
  },
  deactivate(id: string) {
    return apiClient.patch<ForemanDetail>(`/api/foremen/${id}`, {
      action: "deactivate",
    });
  },
  softDelete(id: string) {
    return apiClient.delete<ForemanDetail>(`/api/foremen/${id}`);
  },
  resetPassword(id: string, password: string) {
    return apiClient.post<{ ok: boolean; username: string | null }>(
      `/api/foremen/${id}/reset-password`,
      { password }
    );
  },
};
