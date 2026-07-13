import type { Activity } from "@/types";
import { apiClient } from "@/lib/api/client";

export const activityService = {
  async getAll(): Promise<Activity[]> {
    return apiClient.get<Activity[]>("/api/activity");
  },

  async getByProject(projectId: string): Promise<Activity[]> {
    return apiClient.get<Activity[]>(`/api/activity?projectId=${projectId}`);
  },

  async getRecent(limit = 20): Promise<Activity[]> {
    return apiClient.get<Activity[]>(`/api/activity?recent=${limit}`);
  },
};
