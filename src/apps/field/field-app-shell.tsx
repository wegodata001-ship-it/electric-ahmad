"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, GitBranch, Home, LogOut, User } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { PortalNotificationsMenu } from "@/apps/shared/portal-notifications-menu";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/field", label: "בית", icon: Home, exact: true },
  { href: "/field/workflow", label: "תהליכים", icon: GitBranch },
  { href: "/field/attendance", label: "נוכחות", icon: Clock },
  { href: "/field/profile", label: "פרופיל", icon: User },
] as const;

export function FieldAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/field/delivery-notes/new";
  const { userName, ready, loggingOut, logout } = usePortalSession("field");

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F6F8FB] text-[#64748B]">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-hidden bg-[#F6F8FB] text-[#334155]"
      dir="rtl"
      data-app="field"
      data-layout="portal"
      data-theme="light"
    >
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-[#E2E8F0] bg-white px-4">
        <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandLogo height={26} maxWidth={96} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--brand-primary)]">מנהל עבודה</p>
              <p className="truncate text-sm font-bold text-[#0F172A]">
                {userName || "מנהל עבודה"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PortalNotificationsMenu notificationsHref="/field/notifications" />
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-[#E2E8F0] bg-white px-2.5 text-xs font-bold text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              aria-label="יציאה"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-[375px]:inline">
                {loggingOut ? "…" : "יציאה"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main
        className={
          hideNav
            ? "mx-auto w-full max-w-lg min-w-0 flex-1 overflow-x-hidden px-3 pt-3"
            : "mx-auto w-full max-w-lg min-w-0 flex-1 overflow-x-hidden px-4 pb-32 pt-5"
        }
      >
        {children}
      </main>

      {!hideNav && (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E2E8F0] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(15,23,42,0.04)]">
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
                  active ? "text-[#2563EB]" : "text-[#94A3B8]"
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
