"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CheckSquare,
  FileText,
  GitBranch,
  HardHat,
  LayoutDashboard,
  Truck,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { usePendingApprovalsCount } from "@/apps/shared/use-pending-approvals-count";
import { OfficeHeaderActions } from "@/apps/shared/office-header-actions";
import { OfficeBrandSidebar, type OfficeNavItem } from "@/apps/shared/office-brand-sidebar";
import { cn } from "@/lib/utils";

const NAV: OfficeNavItem[] = [
  { href: "/project", label: "מסך ראשי", icon: LayoutDashboard, exact: true },
  { href: "/project/accounts", label: "עץ פרויקט", icon: GitBranch },
  { href: "/project/subcontractors", label: "קבלני משנה", icon: HardHat },
  { href: "/project/approvals", label: "תיקונים", icon: CheckSquare, badge: true },
  { href: "/project/work-diaries", label: "יומני עבודה", icon: BookOpen },
  { href: "/project/delivery-notes", label: "תעודות משלוח", icon: Truck },
  { href: "/project/documents", label: "מרכז מסמכים", icon: FileText },
  { href: "/project/workflow", label: "ציר תהליכים", icon: GitBranch },
];

export function ProjectAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, role, ready, loggingOut, logout } =
    usePortalSession("project");
  const pendingCount = usePendingApprovalsCount(ready);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-background)] text-[var(--brand-text-muted)]">
        טוען…
      </div>
    );
  }

  const isAccounts =
    pathname === "/project/accounts" ||
    pathname.startsWith("/project/accounts?");

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[var(--brand-background)] text-[var(--brand-text)]"
      dir="rtl"
      data-app="project"
      data-layout="admin"
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <OfficeBrandSidebar
          homeHref="/project"
          items={NAV}
          pathname={pathname}
          pendingCount={pendingCount}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          portalLabel="מנהל פרויקט"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <OfficeHeaderActions
            userName={userName}
            role={role}
            notificationsHref="/project/notifications"
            loggingOut={loggingOut}
            onLogout={logout}
            onMenuClick={() => setMobileOpen(true)}
          />
          <main
            className={cn(
              "min-w-0 flex-1",
              isAccounts ? "px-2 py-2 sm:px-3 sm:py-3" : "px-4 py-5 lg:px-8"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
