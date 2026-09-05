"use client";

import Link from "next/link";
import { usePortalSession } from "@/apps/shared/use-portal-session";

export function DriverAppShell({ children }: { children: React.ReactNode }) {
  const { userName, ready, loggingOut, logout } = usePortalSession("driver");

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
      className="min-h-dvh bg-gradient-to-b from-slate-100 via-white to-slate-50 text-slate-900"
      dir="rtl"
      data-app="driver"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/driver" className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-slate-400">
              OPAL · נהג
            </p>
            <p className="truncate text-base font-black text-slate-900">
              {userName || "נהג משאית"}
            </p>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
          >
            יציאה
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5 pb-10">{children}</main>
    </div>
  );
}
