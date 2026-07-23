"use client";

import { Menu } from "lucide-react";
import type { PortalDefinition } from "@/lib/portals/config";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import { PortalUserMenu } from "@/components/portal/portal-user-menu";
import { PortalNotificationIcon } from "@/components/portal/portal-notification-icon";

type Props = {
  portal: PortalDefinition;
  userName?: string | null;
  onMenuClick: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function PortalHeader({
  portal,
  userName,
  onMenuClick,
  onLogout,
  loggingOut,
}: Props) {
  const { theme } = portal;

  return (
    <header
      className="sticky top-0 z-30 border-b border-gray-200/90 backdrop-blur"
      style={{ background: `${theme.headerTint}f2` }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 lg:hidden"
          aria-label="תפריט"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="hidden h-2 w-2 shrink-0 rounded-full sm:inline-block"
              style={{ background: theme.accent }}
              aria-hidden
            />
            <p className="truncate text-sm font-bold text-gray-900 sm:text-base">
              {portal.headerTitle}
            </p>
          </div>
          <div className="mt-0.5 hidden sm:block">
            <PortalBreadcrumb portal={portal} />
          </div>
        </div>

        <PortalNotificationIcon notificationsHref={`${portal.home}/notifications`} />

        <PortalUserMenu
          userName={userName}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      </div>
      <div className="border-t border-gray-100/80 px-3 py-1.5 sm:hidden">
        <PortalBreadcrumb portal={portal} />
      </div>
    </header>
  );
}
