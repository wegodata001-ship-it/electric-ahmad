import type { GalleryItem } from "@/types";
import { apiClient } from "@/lib/api/client";

export const galleryService = {
  async getAll(): Promise<GalleryItem[]> {
    return apiClient.get<GalleryItem[]>("/api/gallery");
  },

  async getByProject(projectId: string): Promise<GalleryItem[]> {
    return apiClient.get<GalleryItem[]>(`/api/gallery?projectId=${projectId}`);
  },

  async getRecent(limit = 12): Promise<GalleryItem[]> {
    return apiClient.get<GalleryItem[]>(`/api/gallery?recent=${limit}`);
  },
};
