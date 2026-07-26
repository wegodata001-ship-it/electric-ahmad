"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/system", label: "לוח שליטה", exact: true },
  { href: "/system/companies", label: "חברות / פרויקטים" },
  { href: "/system/accounts", label: "חשבונות / עץ פרויקט" },
  { href: "/system/users", label: "משתמשים" },
  { href: "/system/workflow", label: "Workflow" },
  { href: "/system/documents", label: "מסמכים" },
  { href: "/system/share-links", label: "Share Links" },
  { href: "/system/whatsapp", label: "WhatsApp Hub" },
  { href: "/system/notifications", label: "התראות" },
  { href: "/system/settings", label: "הגדרות" },
];

export function SystemAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("system");

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        טוען…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl" data-app="system">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-60 shrink-0 flex-col border-l border-white/10 bg-slate-900 lg:flex">
          <div className="border-b border-white/10 px-4 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
              System Control
            </p>
            <p className="mt-1 text-lg font-black">מרכז שליטה</p>
            <p className="truncate text-xs text-slate-400">{userName}</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-semibold",
                    active
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
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
            className="m-3 rounded-lg border border-white/10 px-3 py-2 text-xs"
          >
            יציאה
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:hidden">
            <p className="font-black">מרכז שליטה</p>
            <button type="button" onClick={() => void logout()} className="text-xs">
              יציאה
            </button>
          </header>
          <nav className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
