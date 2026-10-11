"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  ClipboardList,
  FolderOpen,
  GitBranch,
  HardHat,
  LayoutDashboard,
  User,
  Users,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { usePendingApprovalsCount } from "@/apps/shared/use-pending-approvals-count";
import { OfficeHeaderActions } from "@/apps/shared/office-header-actions";
import { OfficeBrandSidebar, type OfficeNavItem } from "@/apps/shared/office-brand-sidebar";
import { cn } from "@/lib/utils";

const NAV: OfficeNavItem[] = [
  { href: "/operations", label: "מסך ראשי", icon: LayoutDashboard, exact: true },
  { href: "/operations/accounts", label: "עץ פרויקט", icon: GitBranch },
  { href: "/operations/subcontractors", label: "קבלני משנה", icon: HardHat },
  { href: "/operations/approvals", label: "תיקונים", icon: CheckSquare, badge: true },
  { href: "/operations/work-orders", label: "סידורי עבודה", icon: ClipboardList },
  {
    href: "/operations/project-manager-assignments",
    label: "שיוך מנהלי פרויקט",
    icon: Users,
  },
  { href: "/operations/documents", label: "מרכז מסמכים", icon: FolderOpen },
  { href: "/operations/profile", label: "הגדרות", icon: User },
];

export function OpsAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, role, ready, loggingOut, logout } =
    usePortalSession("operations");
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
    pathname === "/operations/accounts" ||
    pathname.startsWith("/operations/accounts?");

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[var(--brand-background)] text-[var(--brand-text)]"
      dir="rtl"
      data-app="operations"
      data-layout="admin"
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <OfficeBrandSidebar
          homeHref="/operations"
          items={NAV}
          pathname={pathname}
          pendingCount={pendingCount}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          portalLabel="מנהל תפעול"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <OfficeHeaderActions
            userName={userName}
            role={role}
            notificationsHref="/operations/notifications"
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
