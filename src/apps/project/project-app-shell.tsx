"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

/**
 * Project Manager portal — desktop workspace (not System Admin).
 * Wide enough for project hub / performance grids; not full-bleed admin.
 */
const NAV = [
  { href: "/project", label: "הבית שלי", exact: true },
  { href: "/project/projects", label: "פרויקטים" },
  { href: "/project/boq", label: "כתב כמויות" },
  { href: "/project/accounts", label: "חשבונות" },
  { href: "/project/documents", label: "מסמכים" },
  { href: "/project/delivery-notes", label: "תעודות" },
  { href: "/project/approvals", label: "חריגות / אישורים" },
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

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      dir="rtl"
      data-app="project"
      data-layout="portal"
    >
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-56 shrink-0 flex-col border-l border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-4 py-5">
            <p className="text-xs font-bold text-blue-700">פורטל פרויקט</p>
            <p className="text-base font-black">ניהול פרויקט</p>
            <p className="truncate text-xs text-slate-500">{userName}</p>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-xl px-3 py-2.5 text-sm font-bold",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
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
            className="m-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
          >
            יציאה
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div>
              <p className="text-sm font-black">ניהול פרויקט</p>
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
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 px-4 py-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
