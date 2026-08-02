"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

/**
 * Project Manager — same project-tree work surface as System/Ops.
 * Differences: assigned projects only + no send-to-client (RBAC).
 */
const NAV = [
  { href: "/project/accounts", label: "עץ פרויקט" },
  { href: "/project/approvals", label: "אישורים" },
  { href: "/project/work-diaries", label: "יומני עבודה" },
  { href: "/project/delivery-notes", label: "תעודות" },
  { href: "/project/documents", label: "מסמכים" },
  { href: "/project/notifications", label: "התראות" },
];

export function ProjectAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("project");

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        טוען…
      </div>
    );
  }

  const isAccounts =
    pathname === "/project/accounts" ||
    pathname.startsWith("/project/accounts?");

  return (
    <div
      className="min-h-screen w-full bg-slate-50 text-slate-900"
      dir="rtl"
      data-app="project"
      data-layout="admin"
      data-theme="light"
    >
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-56 shrink-0 flex-col border-l border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-4 py-5">
            <p className="text-[10px] font-bold tracking-wide text-blue-700">
              מנהל פרויקט
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">מרכז עבודה</p>
            <p className="truncate text-xs text-slate-500">{userName}</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
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

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div>
              <p className="text-sm font-black">מנהל פרויקט</p>
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
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {item.label}
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
