"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { usePendingApprovalsCount } from "@/apps/shared/use-pending-approvals-count";
import { OfficeHeaderActions } from "@/apps/shared/office-header-actions";
import { isSecretaryRole } from "@/lib/auth/attendance-permissions";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { cn } from "@/lib/utils";

const FULL_NAV = [
  { href: "/system/approvals", label: "תיקונים", badge: true },
  { href: "/system/accounts", label: "עץ פרויקט", exact: false },
  { href: "/system/users", label: "משתמשים" },
  { href: "/system/workflow", label: "תהליכי עבודה" },
  { href: "/system/documents", label: "מרכז מסמכים" },
  { href: "/system/settings", label: "הגדרות" },
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

  const nav = useMemo(() => {
    if (isSecretaryRole(role)) return [];
    return FULL_NAV;
  }, [role]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        טוען…
      </div>
    );
  }

  const isAccounts =
    pathname === "/system/accounts" || pathname.startsWith("/system/accounts?");
  const title = isSecretaryRole(role) ? "נוכחות" : "מרכז שליטה";
  const subtitle = isSecretaryRole(role) ? "מזכירה" : "בקרת מערכת";

  return (
    <div
      className="min-h-screen w-full bg-slate-50 text-slate-900"
      dir="rtl"
      data-app="system"
      data-layout="admin"
      data-admin={isSystemAdminRole(role) ? "super" : "secretary"}
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <aside className="flex w-56 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-5">
            <p className="text-[10px] font-bold tracking-wide text-slate-500">
              {subtitle}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">{title}</p>
            <p className="truncate text-xs text-slate-500">{userName}</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {nav.map((item) => {
              const active =
                "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const showBadge = Boolean(
                "badge" in item &&
                  (item as { badge?: boolean }).badge &&
                  pendingCount > 0
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span>{item.label}</span>
                  {showBadge && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-black",
                        active
                          ? "bg-amber-400 text-slate-900"
                          : "bg-amber-500 text-white"
                      )}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <OfficeHeaderActions
            userName={userName}
            role={role}
            notificationsHref="/system/notifications"
            loggingOut={loggingOut}
            onLogout={logout}
          />
          <main
            className={cn(
              "min-w-0 flex-1",
              isAccounts ? "px-3 py-3 lg:px-4" : "px-6 py-6 lg:px-10"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
