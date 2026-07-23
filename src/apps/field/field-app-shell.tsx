"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Home,
  Package,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/field", label: "בית", icon: Home, exact: true },
  { href: "/field/work-orders", label: "סידורים", icon: ClipboardList },
  { href: "/field/work-diaries", label: "יומן", icon: BookOpen },
  { href: "/field/delivery-notes", label: "תעודות", icon: Package },
  { href: "/field/approvals", label: "אישורים", icon: CheckSquare },
] as const;

export function FieldAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("field");

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0b1220] text-white">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#0b1220] text-white"
      dir="rtl"
      data-app="field"
    >
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#0b1220]/95 px-4 backdrop-blur">
        <div>
          <p className="text-xs text-teal-300/80">עבודה בשטח</p>
          <p className="truncate text-sm font-bold">{userName || "מנהל עבודה"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/field/profile"
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
          >
            פרופיל
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
          >
            יציאה
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-3 pb-28 pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#111827]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1">
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
                  "flex min-h-[4.25rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? "text-teal-300" : "text-white/45"
                )}
              >
                <Icon className="h-6 w-6" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
