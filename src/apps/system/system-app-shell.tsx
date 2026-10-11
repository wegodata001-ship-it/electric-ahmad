"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  FolderOpen,
  GitBranch,
  HardHat,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { usePendingApprovalsCount } from "@/apps/shared/use-pending-approvals-count";
import { OfficeHeaderActions } from "@/apps/shared/office-header-actions";
import { OfficeBrandSidebar, type OfficeNavItem } from "@/apps/shared/office-brand-sidebar";
import { isSecretaryRole } from "@/lib/auth/attendance-permissions";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { cn } from "@/lib/utils";

const FULL_NAV: OfficeNavItem[] = [
  { href: "/system", label: "מסך ראשי", icon: LayoutDashboard, exact: true },
  { href: "/system/accounts", label: "עץ פרויקט", icon: GitBranch },
  { href: "/system/subcontractors", label: "קבלני משנה", icon: HardHat },
  { href: "/system/approvals", label: "תיקונים", icon: CheckSquare, badge: true },
  { href: "/system/users", label: "ניהול משתמשים", icon: Users },
  { href: "/system/documents", label: "מרכז מסמכים", icon: FolderOpen },
  { href: "/system/workflow", label: "ציר תהליכים", icon: GitBranch },
  { href: "/system/settings", label: "הגדרות", icon: Settings },
];

/**
 * System Back Office — QR attendance management screen is intentionally hidden.
 */
export function SystemAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, role, ready, loggingOut, logout } = usePortalSession("system");
  const pendingCount = usePendingApprovalsCount(
    ready && !isSecretaryRole(role)
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = useMemo(() => {
    if (isSecretaryRole(role)) return [];
    return FULL_NAV;
  }, [role]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-background)] text-[var(--brand-text-muted)]">
        טוען…
      </div>
    );
  }

  const isAccounts =
    pathname === "/system/accounts" || pathname.startsWith("/system/accounts?");
  const portalLabel = isSecretaryRole(role) ? "מזכירה" : "מנהל מערכת";

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[var(--brand-background)] text-[var(--brand-text)]"
      dir="rtl"
      data-app="system"
      data-layout="admin"
      data-admin={isSystemAdminRole(role) ? "super" : "secretary"}
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <OfficeBrandSidebar
          homeHref="/system"
          items={nav}
          pathname={pathname}
          pendingCount={pendingCount}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          portalLabel={portalLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <OfficeHeaderActions
            userName={userName}
            role={role}
            notificationsHref="/system/notifications"
            loggingOut={loggingOut}
            onLogout={logout}
            onMenuClick={() => setMobileOpen(true)}
          />
          <main
            className={cn(
              "min-w-0 flex-1",
              isAccounts ? "px-3 py-3 lg:px-4" : "px-4 py-5 sm:px-6 lg:px-10"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
