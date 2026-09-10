"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app.store";
import { notificationService } from "@/features/notifications/services/notification.service";
import { ToastProvider } from "@/components/ui/toast";
import { AccessibilityProvider } from "@/components/accessibility/accessibility-provider";
import { AccessibilityButton } from "@/components/accessibility/accessibility-button";

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/manager" ||
    pathname.startsWith("/field/login") ||
    pathname.startsWith("/sign/")
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setNotifications = useAppStore((s) => s.setNotifications);

  useEffect(() => {
    if (isPublicAuthPath(pathname)) return;

    notificationService
      .getAll()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [pathname, setNotifications]);

  return (
    <AccessibilityProvider>
      <ToastProvider>
        {children}
        <AccessibilityButton />
      </ToastProvider>
    </AccessibilityProvider>
  );
}
