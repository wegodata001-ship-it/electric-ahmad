import { apiClient } from "@/lib/api/client";
import type { FieldCrewMember, WorkJournal } from "@/types";

export type FieldDashboard = {
  foreman: {
    id: string;
    name: string;
    phone: string;
    username: string;
    userId: string;
  };
  projects: {
    id: string;
    name: string;
    location: string;
    contractor: string;
  }[];
  crewCount: number;
  openJournal: WorkJournal | null;
  attendance: {
    id: string;
    checkedInAt: string;
    checkedOutAt: string | null;
  } | null;
  checkedIn: boolean;
};

export type JournalSaveBody = {
  projectId?: string;
  date?: string;
  clientName?: string;
  address?: string;
  workArea?: string;
  generalNotes?: string;
  actionsPerformed?: string;
  exceptions?: string;
  equipment?: string;
  notes?: string;
  signatureData?: string | null;
  status?: "draft" | "in_progress";
  workers?: {
    crewMemberId: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    note?: string;
  }[];
};

export const fieldService = {
  getDashboard() {
    return apiClient.get<FieldDashboard>("/api/field/me");
  },

  getCrew() {
    return apiClient.get<FieldCrewMember[]>("/api/field/crew");
  },

  createCrewMember(body: {
    name: string;
    phone?: string;
    profession?: string;
    status?: string;
    notes?: string;
  }) {
    return apiClient.post<FieldCrewMember>("/api/field/crew", body);
  },

  updateCrewMember(
    id: string,
    body: {
      name?: string;
      phone?: string;
      profession?: string;
      status?: string;
      notes?: string;
    }
  ) {
    return apiClient.put<FieldCrewMember>(`/api/field/crew/${id}`, body);
  },

  deleteCrewMember(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/api/field/crew/${id}`);
  },

  checkIn(projectId?: string) {
    return apiClient.post<{ checkedIn: boolean }>("/api/field/attendance", {
      action: "check_in",
      projectId,
    });
  },

  checkOut() {
    return apiClient.post<{ checkedIn: boolean }>("/api/field/attendance", {
      action: "check_out",
    });
  },

  listJournals() {
    return apiClient.get<WorkJournal[]>("/api/work-journals");
  },

  getJournal(id: string) {
    return apiClient.get<WorkJournal>(`/api/work-journals/${id}`);
  },

  createJournal(
    body: JournalSaveBody & {
      projectId: string;
      date: string;
      status?: "draft" | "in_progress";
    }
  ) {
    return apiClient.post<WorkJournal>("/api/work-journals", body);
  },

  saveJournal(id: string, body: JournalSaveBody) {
    return apiClient.put<WorkJournal>(`/api/work-journals/${id}`, body);
  },

  submitJournal(id: string) {
    return apiClient.post<WorkJournal>(`/api/work-journals/${id}/submit`);
  },

  uploadMedia(id: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.upload(`/api/work-journals/${id}/media`, fd);
  },
};
