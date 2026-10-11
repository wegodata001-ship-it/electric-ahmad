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
  async getAll(ownerId?: string): Promise<Project[]> {
    const q = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
    return apiClient.get<Project[]>(`/api/projects${q}`);
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
      pending?: boolean;
      success: boolean;
      status?: string;
      parsed: unknown;
      missingFields: string[];
      itemsDetected: number;
      durationMs?: number;
      error?: string;
      message: string;
    }>("/api/projects/from-pdf", formData, 120_000);
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
      pending?: boolean;
      success: boolean;
      status?: string;
      parsed: unknown;
      missingFields: string[];
      itemsDetected: number;
      error?: string;
    }>("/api/ai/reparse", { projectId, documentId });
  },

  async getProjectScanJob(projectId: string) {
    return apiClient.get<{
      job: {
        id: string;
        status: string;
        documentId: string | null;
        projectId: string | null;
        itemsDetected: number;
        fieldsMissing: number;
        error: string | null;
        errorCode: string | null;
        parsed: unknown;
        createdAt: string;
      } | null;
    }>(`/api/projects/${projectId}/scan-job`);
  },

  async runParse(parseLogId: string) {
    return apiClient.post<{
      parseLogId: string;
      status?: string;
      pending?: boolean;
      skipped?: boolean;
      success: boolean;
      parsed?: unknown;
      missingFields?: string[];
      itemsDetected?: number;
      error?: string;
    }>(`/api/ai/parse-logs/${parseLogId}/run`);
  },

  async confirmParsed(payload: {
    projectId: string;
    parseLogId: string;
    project: Record<string, unknown>;
    items: Record<string, unknown>[];
    ownerId?: string | null;
  }) {
    return apiClient.post<{ project: Project; itemsCount: number }>(
      "/api/projects/confirm-parsed",
      payload
    );
  },

  async listProjectManagers() {
    return apiClient.get<{
      items: { id: string; name: string; username: string; status: string }[];
    }>("/api/project-managers");
  },

  async assignProjectManager(projectId: string, ownerId: string | null) {
    return apiClient.patch<Project>(`/api/projects/${projectId}`, { ownerId });
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
export { documentService } from "@/features/documents/services/document.service";
export { invoiceService } from "@/features/partial-invoices/services/invoice.service";
export { galleryService } from "@/features/gallery/services/gallery.service";
export { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
export { clientService } from "@/features/clients/services/client.service";
export { activityService } from "@/features/activity/services/activity.service";
export { notificationService } from "@/features/notifications/services/notification.service";
