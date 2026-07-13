import type { Notification } from "@/types";
import { apiClient } from "@/lib/api/client";

export const notificationService = {
  async getAll(): Promise<Notification[]> {
    return apiClient.get<Notification[]>("/api/notifications");
  },

  async getUnread(): Promise<Notification[]> {
    const all = await this.getAll();
    return all.filter((n) => !n.read);
  },

  async markAsRead(id: string): Promise<void> {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  },

  async markAllAsRead(): Promise<void> {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  },
};
