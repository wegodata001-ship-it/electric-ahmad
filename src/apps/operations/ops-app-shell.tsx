"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckSquare,
  ClipboardList,
  Clock,
  Home,
  User,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/operations", label: "בית", icon: Home, exact: true },
  { href: "/operations/attendance", label: "נוכחות", icon: Clock },
  { href: "/operations/work-orders", label: "סידורים", icon: ClipboardList },
  { href: "/operations/approvals", label: "אישורים", icon: CheckSquare },
  { href: "/operations/notifications", label: "התראות", icon: Bell },
  { href: "/operations/profile", label: "פרופיל", icon: User },
] as const;

export function OpsAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("operations");

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#fff7ed] text-amber-900">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#fff7ed] text-stone-900"
      dir="rtl"
      data-app="operations"
    >
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-amber-200/80 bg-[#fffbeb]/95 px-4 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-amber-800">תפעול יומי</p>
          <p className="truncate text-sm font-black">{userName || "מנהל תפעול"}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold"
        >
          יציאה
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-3 pb-28 pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200/80 bg-white/98 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-0.5">
          {TABS.map((tab) => {
            const exact = "exact" in tab && tab.exact;
            const active = exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-[4.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold leading-tight",
                  active ? "text-amber-800" : "text-stone-400"
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
