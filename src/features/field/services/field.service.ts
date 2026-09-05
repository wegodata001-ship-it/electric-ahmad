import { apiClient } from "@/lib/api/client";
import type {
  FieldAttendanceHistoryEntry,
  FieldAttendancePersonalSummary,
  FieldCrewHoursSummary,
  FieldCrewMember,
  FieldCrewTimeEntry,
} from "@/types";

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
  openJournal: null; // removed WorkJournal
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

  checkIn(meta: {
    projectId?: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    deviceLabel?: string | null;
    userAgent?: string | null;
  }) {
    return apiClient.post<{ checkedIn: boolean }>("/api/field/attendance", {
      action: "check_in",
      ...meta,
    });
  },

  checkOut(meta: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    deviceLabel?: string | null;
    userAgent?: string | null;
  }) {
    return apiClient.post<{ checkedIn: boolean }>("/api/field/attendance", {
      action: "check_out",
      ...meta,
    });
  },

  getCrewTimeEntries(crewMemberId: string) {
    return apiClient.get<{
      entries: FieldCrewTimeEntry[];
      summary: FieldCrewHoursSummary;
    }>(`/api/field/crew/${crewMemberId}/time-entries`);
  },

  createCrewTimeEntry(
    crewMemberId: string,
    body: {
      date: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    }
  ) {
    return apiClient.post<{
      entry: FieldCrewTimeEntry;
      summary: FieldCrewHoursSummary;
    }>(`/api/field/crew/${crewMemberId}/time-entries`, body);
  },

  updateCrewTimeEntry(
    entryId: string,
    body: {
      date?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    }
  ) {
    return apiClient.put<{
      entry: FieldCrewTimeEntry;
      summary: FieldCrewHoursSummary;
    }>(`/api/field/crew/time-entries/${entryId}`, body);
  },

  deleteCrewTimeEntry(entryId: string) {
    return apiClient.delete<{
      ok: boolean;
      summary: FieldCrewHoursSummary;
      crewMemberId: string;
    }>(`/api/field/crew/time-entries/${entryId}`);
  },

  getAttendanceHistory(params?: {
    period?: "today" | "week" | "month" | "range" | "all";
    from?: string;
    to?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.period) q.set("period", params.period);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiClient.get<{
      entries: FieldAttendanceHistoryEntry[];
      summary: FieldAttendancePersonalSummary;
    }>(`/api/field/attendance/history${qs ? `?${qs}` : ""}`);
  },
};
