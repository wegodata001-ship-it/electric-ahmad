"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { canManageAttendance, isSecretaryRole } from "@/lib/auth/attendance-permissions";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { cn } from "@/lib/utils";

const FULL_NAV = [
  { href: "/system/accounts", label: "עץ פרויקט", exact: false },
  { href: "/system/attendance-qr", label: "QR לנוכחות" },
  { href: "/system/users", label: "משתמשים" },
  { href: "/system/workflow", label: "תהליכי עבודה" },
  { href: "/system/documents", label: "מסמכים" },
  { href: "/system/share-links", label: "קישורי שיתוף" },
  { href: "/system/whatsapp", label: "מרכז וואטסאפ" },
  { href: "/system/notifications", label: "התראות" },
  { href: "/system/settings", label: "הגדרות" },
];

const SECRETARY_NAV = [
  { href: "/system/attendance-qr", label: "QR לנוכחות" },
];

/**
 * System Back Office — System Manager full nav; Secretary = attendance only.
 */
export function SystemAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userName, role, ready, loggingOut, logout } = usePortalSession("system");

  const nav = useMemo(() => {
    if (isSecretaryRole(role)) return SECRETARY_NAV;
    return FULL_NAV;
  }, [role]);

  useEffect(() => {
    if (!ready || !role) return;
    if (isSecretaryRole(role) && !pathname.startsWith("/system/attendance-qr")) {
      router.replace("/system/attendance-qr");
    }
  }, [ready, role, pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        טוען…
      </div>
    );
  }

  // Defense: non-admin / non-secretary shouldn't linger on attendance-qr via shell
  if (
    pathname.startsWith("/system/attendance-qr") &&
    !canManageAttendance(role)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        אין הרשאה
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-semibold",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="m-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            יציאה
          </button>
        </aside>

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
  );
}
