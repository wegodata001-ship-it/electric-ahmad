import { apiClient } from "@/lib/api/client";

export const invoicesWorkspaceService = {
  listProjects() {
    return apiClient.get<{ projects: any[] }>("/api/invoices/workspace");
  },

  getTree(projectId: string) {
    return apiClient.get<any>(`/api/invoices/workspace?projectId=${projectId}`);
  },

  updateAxis(projectId: string, measurementAxisType: string, measurementAxisLabel?: string) {
    return apiClient.patch("/api/invoices/workspace", {
      projectId,
      measurementAxisType,
      measurementAxisLabel,
    });
  },

  listSheets(projectId: string) {
    return apiClient.get<{ items: any[] }>(
      `/api/measurement-sheets?projectId=${projectId}`
    );
  },

  getSheet(id: string) {
    return apiClient.get<any>(`/api/measurement-sheets/${id}`);
  },

  createSheet(body: {
    projectId: string;
    title: string;
    notes?: string;
    rowNames?: string[];
  }) {
    return apiClient.post<any>("/api/measurement-sheets", body);
  },

  addRows(sheetId: string, names: string[]) {
    return apiClient.post<any>(`/api/measurement-sheets/${sheetId}/rows`, { names });
  },

  setCell(sheetId: string, body: { rowId: string; boqItemId: string; quantity: number }) {
    return apiClient.put<any>(`/api/measurement-sheets/${sheetId}/cells`, body);
  },

  saveCells(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[]
  ) {
    return apiClient.put<any>(`/api/measurement-sheets/${sheetId}/cells`, {
      cells,
    });
  },

  completeSheet(sheetId: string) {
    return apiClient.post<{
      sheet: any;
      document: { name: string; folderPath: string; url: string };
    }>(`/api/measurement-sheets/${sheetId}/complete`);
  },

  submitForApproval(sheetId: string, approverIds: string[]) {
    return apiClient.post<{
      sheet: any;
      document: { name: string; folderPath: string; url: string };
    }>(`/api/measurement-sheets/${sheetId}/submit`, { approverIds });
  },

  getEntries(sheetId: string) {
    return apiClient.get<{ items: any[] }>(`/api/measurement-sheets/${sheetId}/entries`);
  },

  getSummary(projectId: string, sheetIds?: string[]) {
    const q = sheetIds?.length ? `&sheetIds=${sheetIds.join(",")}` : "";
    return apiClient.get<any>(`/api/invoices/summary?projectId=${projectId}${q}`);
  },

  generateInvoice(body: {
    projectId: string;
    sheetIds?: string[];
    billingMonth?: string;
    createDocumentFolder?: boolean;
    notes?: string;
  }) {
    return apiClient.post<any>("/api/invoices/summary", body);
  },
};
