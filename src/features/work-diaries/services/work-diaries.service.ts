import { apiClient } from "@/lib/api/client";

export type WorkDiaryListItem = {
  id: string;
  documentNumber: string;
  status: string;
  workDate: string;
  workType: string | null;
  clientName: string | null;
  customSiteName?: string | null;
  siteLabel?: string | null;
  project: { id: string; name: string } | null;
  foreman: { id: string; name: string } | null;
  createdAt: string;
};

export const workDiariesService = {
  list(status?: string) {
    const q = status ? `?status=${status}` : "";
    return apiClient.get<{ items: WorkDiaryListItem[] }>(`/api/field/work-diaries${q}`);
  },

  peekNumber() {
    return apiClient.get<{ documentNumber: string }>("/api/field/work-diaries?peekNumber=1");
  },

  get(id: string) {
    return apiClient.get<any>(`/api/field/work-diaries/${id}`);
  },

  create(body: unknown) {
    return apiClient.post<any>("/api/field/work-diaries", body);
  },

  update(id: string, body: unknown) {
    return apiClient.patch<any>(`/api/field/work-diaries/${id}`, body);
  },

  remove(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/api/field/work-diaries/${id}`);
  },

  submit(id: string, approverIds: string[]) {
    return apiClient.post<any>(`/api/field/work-diaries/${id}/submit`, { approverIds });
  },

  listApprovers(projectId?: string | null) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return apiClient.get<{
      items: {
        id: string;
        name: string;
        roleLabel: string;
        role?: string;
        group?: string;
      }[];
    }>(`/api/field/approvers${q}`);
  },
};

export const opsDeliveryNotesService = {
  list(status?: string) {
    const q = status ? `?status=${status}` : "";
    return apiClient.get<{ items: any[] }>(`/api/field/ops-delivery-notes${q}`);
  },

  peekNumber() {
    return apiClient.get<{ documentNumber: string }>(
      "/api/field/ops-delivery-notes?peekNumber=1"
    );
  },

  get(id: string) {
    return apiClient.get<any>(`/api/field/ops-delivery-notes/${id}`);
  },

  create(body: unknown) {
    return apiClient.post<any>("/api/field/ops-delivery-notes", body);
  },

  update(id: string, body: unknown) {
    return apiClient.patch<any>(`/api/field/ops-delivery-notes/${id}`, body);
  },

  submit(id: string, approverIds: string[]) {
    return apiClient.post<any>(`/api/field/ops-delivery-notes/${id}/submit`, {
      approverIds,
    });
  },
};

export const approvalsService = {
  pending() {
    return apiClient.get<{ items: any[] }>("/api/approvals/pending");
  },

  /** מסמכים שחזרו לתיקון — למרכז «תיקונים» */
  revisions() {
    return apiClient.get<{ items: any[]; count: number }>(
      "/api/approvals/revisions"
    );
  },

  decide(body: {
    kind: "work_diary" | "delivery_note" | "measurement_sheet";
    documentId: string;
    decision: "approved" | "rejected";
    comment?: string;
    reviewNotes?: {
      rowId?: string | null;
      boqItemId?: string | null;
      comment: string;
    }[];
    rejectReasonId?: string;
    rejectAttachments?: string[];
    approveOptions?: {
      saveToDocuments?: boolean;
      notifyCreator?: boolean;
      sendToClient?: boolean;
    };
  }) {
    return apiClient.post("/api/approvals/pending", body);
  },

  review(kind: string, documentId: string) {
    return apiClient.get<{
      kind: string;
      document: any;
      related: { documents: any[]; photos: any[] };
      timeline: any[];
      conversation: any[];
      workflowDocumentId: string | null;
    }>(
      `/api/approvals/review?kind=${encodeURIComponent(kind)}&documentId=${encodeURIComponent(documentId)}`
    );
  },

  sendWorkDiaryToClient(id: string, phone?: string) {
    return apiClient.post<{ url: string; whatsappUrl: string; message: string }>(
      `/api/work-diaries/${id}/send-client`,
      { phone }
    );
  },

  sendDeliveryNoteToClient(id: string, phone?: string) {
    return apiClient.post<{
      url: string;
      whatsappUrl: string;
      smsUrl?: string;
      emailUrl?: string;
      message: string;
      documentNumber: string;
    }>(`/api/ops-delivery-notes/${id}/send-client`, { phone });
  },

  sendMeasurementSheetToClient(
    id: string,
    body?: { phone?: string; message?: string }
  ) {
    return apiClient.post<{
      url: string;
      whatsappUrl: string;
      message: string;
      documentNumber: string;
    }>(`/api/measurement-sheets/${id}/send-client`, body ?? {});
  },
};
