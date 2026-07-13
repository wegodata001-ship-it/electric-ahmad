import type { WorkReport } from "@/types";
import { apiClient } from "@/lib/api/client";

export const reportService = {
  async getAll(): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>("/api/reports");
  },

  async getByProject(projectId: string): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>(`/api/reports?projectId=${projectId}`);
  },

  async getByEmployee(employeeId: string): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>(`/api/reports?employeeId=${employeeId}`);
  },

  async getToday(): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>("/api/reports?today=true");
  },

  async getRecent(limit = 10): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>(`/api/reports?recent=${limit}`);
  },
};
