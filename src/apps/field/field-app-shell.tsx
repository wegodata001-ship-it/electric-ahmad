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
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F8FA] text-[#6B7280]">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#F7F8FA] text-[#111827]"
      dir="rtl"
      data-app="field"
      data-layout="portal"
      data-theme="light"
    >
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur">
        <div>
          <p className="text-xs font-semibold text-blue-600">עבודה בשטח</p>
          <p className="truncate text-sm font-bold text-[#111827]">
            {userName || "מנהל עבודה"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="min-h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#6B7280]"
        >
          יציאה
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-32 pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
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
                  "flex min-h-[4.5rem] flex-1 flex-col items-center justify-center gap-1 text-xs font-bold",
                  active ? "text-blue-600" : "text-[#9CA3AF]"
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
