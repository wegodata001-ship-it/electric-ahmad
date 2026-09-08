"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { usePendingApprovalsCount } from "@/apps/shared/use-pending-approvals-count";
import { cn } from "@/lib/utils";

/**
 * Operations Manager — same work surface as System Admin (project tree),
 * differences enforced by permissions only (no send-to-client).
 */
const NAV = [
  { href: "/operations/approvals", label: "תיקונים", badge: true },
  { href: "/operations/accounts", label: "עץ פרויקט", exact: false },
  { href: "/operations/work-orders", label: "סידורים" },
  { href: "/operations/documents", label: "מסמכים" },
  { href: "/operations/share-links", label: "קישורי שיתוף" },
  { href: "/operations/notifications", label: "התראות" },
  { href: "/operations/profile", label: "פרופיל" },
];

export function OpsAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("operations");
  const pendingCount = usePendingApprovalsCount(ready);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        טוען…
      </div>
    );
  }

  const isAccounts =
    pathname === "/operations/accounts" ||
    pathname.startsWith("/operations/accounts?");

  return (
    <div
      className="min-h-screen w-full bg-slate-50 text-slate-900"
      dir="rtl"
      data-app="operations"
      data-layout="admin"
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-56 shrink-0 flex-col border-l border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-4 py-5">
            <p className="text-[10px] font-bold tracking-wide text-amber-700">
              מנהל תפעול
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">מרכז עבודה</p>
            <p className="truncate text-xs text-slate-500">{userName}</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const showBadge = item.badge && pendingCount > 0;
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
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="m-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            יציאה
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div>
              <p className="text-sm font-black">מנהל תפעול</p>
              <p className="text-xs text-slate-500">{userName}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border px-2 py-1 text-xs"
            >
              יציאה
            </button>
          </header>
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {item.label}
                {item.badge && pendingCount > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-slate-900">
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
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
