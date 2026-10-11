"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  PortalNotificationsMenu,
  resolveDriverNotificationLink,
} from "@/apps/shared/portal-notifications-menu";

type Props = {
  userName: string | null;
  loggingOut: boolean;
  onLogout: () => void | Promise<void>;
};

export function DriverPortalHeader({
  userName,
  loggingOut,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#DCE4EF] bg-white">
      <div className="mx-auto flex h-[64px] max-w-2xl items-center justify-between gap-2 px-4">
        <Link
          href="/driver"
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <BrandLogo height={28} maxWidth={96} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#0F172A]">
              {userName || "נהג משאית"}
            </p>
            <p className="truncate text-xs font-semibold text-[#64748B]">
              נהג משאית / שליח
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <PortalNotificationsMenu
            notificationsHref="/driver/notifications"
            resolveLink={resolveDriverNotificationLink}
          />
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void onLogout()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DCE4EF] bg-white px-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
            aria-label="יציאה"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden min-[375px]:inline">
              {loggingOut ? "יוצא…" : "יציאה"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
