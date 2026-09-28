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

  addRows(sheetId: string, names: string[], expectedVersion?: number) {
    return apiClient.post<any>(`/api/measurement-sheets/${sheetId}/rows`, {
      names,
      expectedVersion,
    });
  },

  renameRow(
    sheetId: string,
    rowId: string,
    name: string,
    expectedVersion?: number
  ) {
    return apiClient.patch<any>(`/api/measurement-sheets/${sheetId}/rows`, {
      rowId,
      name,
      expectedVersion,
    });
  },

  deleteRow(sheetId: string, rowId: string, expectedVersion?: number) {
    return apiClient.delete<any>(`/api/measurement-sheets/${sheetId}/rows`, {
      rowId,
      expectedVersion,
    });
  },

  updateSheet(
    sheetId: string,
    body: { title?: string; notes?: string | null; expectedVersion?: number }
  ) {
    return apiClient.patch<any>(`/api/measurement-sheets/${sheetId}`, body);
  },

  listRooms(projectId: string, includeHidden = false) {
    const q = includeHidden ? "?includeHidden=1" : "";
    return apiClient.get<{ items: any[] }>(
      `/api/projects/${projectId}/rooms${q}`
    );
  },

  createRoom(
    projectId: string,
    body: {
      name: string;
      floor?: string | null;
      code?: string | null;
      sortOrder?: number | null;
    }
  ) {
    return apiClient.post<any>(`/api/projects/${projectId}/rooms`, body);
  },

  updateRoom(
    projectId: string,
    roomId: string,
    body: Record<string, unknown>
  ) {
    return apiClient.patch<any>(
      `/api/projects/${projectId}/rooms/${roomId}`,
      body
    );
  },

  deleteRoom(projectId: string, roomId: string) {
    return apiClient.delete<{ ok: boolean }>(
      `/api/projects/${projectId}/rooms/${roomId}`
    );
  },

  reorderRooms(projectId: string, orderedIds: string[]) {
    return apiClient.put<{ items: any[] }>(
      `/api/projects/${projectId}/rooms`,
      { orderedIds }
    );
  },

  setCell(sheetId: string, body: { rowId: string; boqItemId: string; quantity: number }) {
    return apiClient.put<any>(`/api/measurement-sheets/${sheetId}/cells`, body);
  },

  saveCells(
    sheetId: string,
    cells: { rowId: string; boqItemId: string; quantity: number }[],
    opts?: { approvalReviewEdit?: boolean; expectedVersion?: number }
  ) {
    return apiClient.put<any>(`/api/measurement-sheets/${sheetId}/cells`, {
      cells,
      ...(opts?.approvalReviewEdit
        ? {
            approvalReviewEdit: true,
            expectedVersion: opts.expectedVersion,
          }
        : {}),
    });
  },

  /** Fill missing BOQ columns on an existing sheet (seeds starter BOQ if needed). */
  ensureGrid(sheetId: string, seedIfEmpty = true) {
    return apiClient.post<any>(
      `/api/measurement-sheets/${sheetId}/ensure-grid`,
      { seedIfEmpty }
    );
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

  finalizeDirectInvoice(sheetId: string) {
    return apiClient.post<any>(
      `/api/measurement-sheets/${sheetId}/direct-invoice`
    );
  },
};
