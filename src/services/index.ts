import type { DashboardKPIs, Project, SearchResult } from "@/types";
import { apiClient } from "@/lib/api/client";

export type CreateProjectInput = {
  name: string;
  contractNumber: string;
  contractor: string;
  location: string;
  foremanName?: string;
  contractValue: number;
  description?: string;
};

export const projectService = {
  async getAll(): Promise<Project[]> {
    return apiClient.get<Project[]>("/api/projects");
  },

  async getById(id: string): Promise<Project | undefined> {
    try {
      return await apiClient.get<Project>(`/api/projects/${id}`);
    } catch {
      return undefined;
    }
  },

  async getActive(): Promise<Project[]> {
    return apiClient.get<Project[]>("/api/projects?status=active");
  },

  async getRecent(limit = 5): Promise<Project[]> {
    return apiClient.get<Project[]>(`/api/projects?recent=${limit}`);
  },

  async create(data: CreateProjectInput): Promise<Project> {
    return apiClient.post<Project>("/api/projects", data);
  },

  async createFromPdf(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<{
      projectId: string;
      documentId: string;
      parseLogId: string;
      success: boolean;
      parsed: unknown;
      missingFields: string[];
      itemsDetected: number;
      durationMs: number;
      error?: string;
      message: string;
    }>("/api/projects/from-pdf", formData);
  },

  async getParseLog(parseLogId: string) {
    return apiClient.get<{
      id: string;
      status: string;
      documentId: string | null;
      projectId: string | null;
      project: Project | null;
      itemsDetected: number;
      fieldsMissing: number;
      durationMs: number | null;
      error: string | null;
      parsed: unknown;
    }>(`/api/ai/parse-logs/${parseLogId}`);
  },

  async reparse(projectId: string, documentId: string) {
    return apiClient.post<{
      parseLogId: string;
      success: boolean;
      parsed: unknown;
      missingFields: string[];
      itemsDetected: number;
      error?: string;
    }>("/api/ai/reparse", { projectId, documentId });
  },

  async confirmParsed(payload: {
    projectId: string;
    parseLogId: string;
    project: Record<string, unknown>;
    items: Record<string, unknown>[];
  }) {
    return apiClient.post<{ project: Project; itemsCount: number }>(
      "/api/projects/confirm-parsed",
      payload
    );
  },
};

export const dashboardService = {
  async getKPIs(): Promise<DashboardKPIs> {
    return apiClient.get<DashboardKPIs>("/api/dashboard");
  },

  async getChartData(): Promise<{ name: string; completed: number; remaining: number; progress: number }[]> {
    return apiClient.get("/api/dashboard?type=chart");
  },

  async getProgressData(): Promise<{ month: string; planned: number; actual: number }[]> {
    return apiClient.get("/api/dashboard?type=progress");
  },
};

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    return apiClient.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`);
  },
};

export { boqService } from "@/features/boq/services/boq.service";
export { employeeService } from "@/features/employees/services/employee.service";
export { reportService } from "@/features/reports/services/report.service";
export { documentService } from "@/features/documents/services/document.service";
export { invoiceService } from "@/features/partial-invoices/services/invoice.service";
export { galleryService } from "@/features/gallery/services/gallery.service";
export { activityService } from "@/features/activity/services/activity.service";
export { notificationService } from "@/features/notifications/services/notification.service";
