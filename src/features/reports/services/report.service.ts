import type { DailyReport, DailyReportStatus, WorkReport } from "@/types";
import { apiClient } from "@/lib/api/client";

export const reportService = {
  async getAll(): Promise<DailyReport[]> {
    return apiClient.get<DailyReport[]>("/api/reports");
  },

  async getById(id: string): Promise<DailyReport> {
    return apiClient.get<DailyReport>(`/api/reports/${id}`);
  },

  async getByProject(projectId: string): Promise<DailyReport[]> {
    return apiClient.get<DailyReport[]>(`/api/reports?projectId=${projectId}`);
  },

  async getByForeman(foremanId: string): Promise<DailyReport[]> {
    return apiClient.get<DailyReport[]>(
      `/api/reports?foremanId=${foremanId}`
    );
  },

  /** Alias used by worker UI — maps to foreman/employee filter on daily reports */
  async getByEmployee(employeeId: string): Promise<DailyReport[]> {
    return this.getByForeman(employeeId);
  },

  async getRecent(limit = 10): Promise<DailyReport[]> {
    return apiClient.get<DailyReport[]>(`/api/reports?recent=${limit}`);
  },

  async update(
    id: string,
    data: { officeNotes?: string; status?: DailyReportStatus }
  ): Promise<DailyReport> {
    return apiClient.patch<DailyReport>(`/api/reports/${id}`, data);
  },

  async approve(id: string): Promise<DailyReport> {
    return this.update(id, { status: "approved" });
  },

  /** Legacy BOQ quantity reports */
  async getLegacyAll(): Promise<WorkReport[]> {
    return apiClient.get<WorkReport[]>("/api/reports?legacy=1");
  },
};
