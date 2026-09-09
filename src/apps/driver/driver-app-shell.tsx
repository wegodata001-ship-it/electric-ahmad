"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Truck, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/driver", label: "בית", icon: Home, exact: true },
  { href: "/driver/delivery-notes", label: "תעודות", icon: FileText },
  { href: "/driver/profile", label: "פרופיל", icon: UserRound },
] as const;

export function DriverAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready } = usePortalSession("driver");

  if (!ready) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-500"
        dir="rtl"
      >
        טוען…
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-900"
      dir="rtl"
      data-app="driver"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <Link
          href="/driver"
          className="mx-auto flex max-w-2xl items-center gap-3"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-800">
            <Truck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {userName || "נהג משאית"}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              נהג משאית / שליח
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              ניהול תעודות המשלוח והפעילות שלך
            </p>
          </div>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-28">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active = "exact" in item && item.exact
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
                  active ? "text-slate-900" : "text-slate-400"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
