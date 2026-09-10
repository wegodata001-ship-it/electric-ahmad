"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { DriverPortalHeader } from "@/apps/driver/driver-portal-header";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/driver", label: "בית", icon: Home, exact: true },
  { href: "/driver/delivery-notes", label: "תעודות", icon: FileText },
  { href: "/driver/profile", label: "פרופיל", icon: UserRound },
] as const;

export function DriverAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("driver");

  if (!ready) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-[#F6F8FC] text-[#64748B]"
        dir="rtl"
      >
        טוען…
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh overflow-x-hidden bg-[#F6F8FC] text-[#0F172A]"
      dir="rtl"
      data-app="driver"
    >
      <DriverPortalHeader
        userName={userName}
        loggingOut={loggingOut}
        onLogout={logout}
      />
      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-28">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DCE4EF] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold",
                  active ? "text-[#2563EB]" : "text-[#94A3B8]"
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg",
                    active && "bg-[#EFF6FF]"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
