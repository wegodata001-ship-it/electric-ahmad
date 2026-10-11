"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  FileText,
  HardHat,
  Home,
  LogOut,
  MoreHorizontal,
  Receipt,
  Ruler,
  User,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

const DESKTOP_NAV = [
  { href: "/subcontractor", label: "בית", icon: Home, exact: true },
  { href: "/subcontractor/works", label: "עבודות", icon: HardHat },
  { href: "/subcontractor/reports", label: "דיווחים", icon: BookOpen },
  { href: "/subcontractor/measurements", label: "מדידות", icon: Ruler },
  { href: "/subcontractor/finance", label: "חשבונות ותשלומים", icon: Receipt, finance: true },
  { href: "/subcontractor/documents", label: "מסמכים", icon: FileText },
  { href: "/subcontractor/profile", label: "הפרופיל שלי", icon: User },
] as const;

const MOBILE_NAV = [
  { href: "/subcontractor", label: "בית", icon: Home, exact: true },
  { href: "/subcontractor/works", label: "עבודות", icon: HardHat },
  { href: "/subcontractor/reports", label: "דיווחים", icon: BookOpen },
  { href: "/subcontractor/finance", label: "חשבונות", icon: Receipt, finance: true },
  { href: "/subcontractor/more", label: "עוד", icon: MoreHorizontal },
] as const;

export function SubcontractorAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = /\/subcontractor\/(works|measurements)\/[^/]+$/.test(pathname);
  const {
    userName,
    companyName,
    canViewFinance,
    ready,
    loggingOut,
    logout,
  } = usePortalSession("subcontractor");
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const displayName =
    companyName && !/portal-|@|cm[a-z0-9]{8}/i.test(companyName)
      ? companyName
      : userName || "קבלן משנה";

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ items: Array<{ read: boolean }> }>("/api/subcontractor/notifications")
      .then((r) => {
        if (live) setUnread(r.items.filter((i) => !i.read).length);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F6F7F8] text-[#5B6470]">
        טוען…
      </div>
    );
  }

  const desktopNav = DESKTOP_NAV.filter((t) => !("finance" in t) || canViewFinance);
  const mobileNav = canViewFinance
    ? MOBILE_NAV
    : [
        MOBILE_NAV[0],
        MOBILE_NAV[1],
        MOBILE_NAV[2],
        { href: "/subcontractor/measurements", label: "מדידות", icon: Ruler },
        MOBILE_NAV[4],
      ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F6F7F8] text-[#111111]" dir="rtl">
      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-l border-[#E6E8EB] bg-white lg:flex">
          <div className="border-b border-[#E6E8EB] px-5 py-5">
            <BrandLogo height={44} maxWidth={168} />
            <div className="mt-3">
              <BrandWordmark />
              <p className="mt-1 text-xs font-bold text-[#C8102E]">פורטל קבלני משנה</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {desktopNav.map((tab) => {
              const active = "exact" in tab && tab.exact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold",
                    active ? "bg-[#FDECEE] text-[#C8102E]" : "text-[#5B6470] hover:bg-[#F8F8F8]"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-[#E6E8EB] bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="lg:hidden">
                  <BrandLogo height={28} maxWidth={110} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">שלום, {displayName}</p>
                  <p className="truncate text-[11px] font-semibold text-[#5B6470]">
                    פורטל קבלני משנה
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/subcontractor/more"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E8EB]"
                  aria-label="התראות"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -left-1 -top-1 rounded-full bg-[#C8102E] px-1.5 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E8EB]"
                    onClick={() => setMenu((v) => !v)}
                    aria-label="תפריט משתמש"
                  >
                    <User className="h-4 w-4" />
                  </button>
                  {menu && (
                    <div className="absolute left-0 top-12 z-50 w-44 rounded-xl border border-[#E6E8EB] bg-white p-2 shadow">
                      <Link href="/subcontractor/profile" className="block rounded-lg px-3 py-2 text-sm font-bold">
                        פרופיל
                      </Link>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-red-700"
                        onClick={() => void logout()}
                        disabled={loggingOut}
                      >
                        <LogOut className="h-4 w-4" />
                        יציאה
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 sm:px-6",
              hideNav ? "pb-6" : "pb-28 lg:pb-10"
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E6E8EB] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-lg justify-between px-1">
            {mobileNav.map((tab) => {
              const active = "exact" in tab && tab.exact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold",
                    active ? "text-[#C8102E]" : "text-[#5B6470]"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
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
