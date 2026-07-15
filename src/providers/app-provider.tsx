"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app.store";
import { notificationService } from "@/features/notifications/services/notification.service";
import { ToastProvider } from "@/components/ui/toast";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const setNotifications = useAppStore((s) => s.setNotifications);

  useEffect(() => {
    notificationService.getAll().then(setNotifications);
  }, [setNotifications]);

  return <ToastProvider>{children}</ToastProvider>;
}
