"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PortalId } from "@/lib/portals/config";
import { PORTALS } from "@/lib/portals/config";
import { canAccessPortal, portalHomeOrLogin } from "@/lib/portals/access";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";

type Props = {
  portalId: PortalId;
  children: React.ReactNode;
};

export function PortalShell({ portalId, children }: Props) {
  const portal = PORTALS[portalId];
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const meUrl = portalId === "field" ? "/api/field/auth/me" : "/api/auth/me";
    fetch(meUrl)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          router.replace("/login");
          return;
        }
        setUserName(json.data?.name ?? null);
        const role = json.data?.role as string | undefined;
        if (!canAccessPortal(role, portalId)) {
          router.replace(portalHomeOrLogin(role));
        }
      })
      .catch(() => undefined);
  }, [portalId, router]);

  async function logout() {
    setLoggingOut(true);
    try {
      if (portalId === "field") {
        await fetch("/api/field/auth/logout", { method: "POST" });
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
      }
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const shellStyle = {
    "--portal-accent": portal.theme.accent,
    "--portal-accent-soft": portal.theme.accentSoft,
    "--portal-accent-muted": portal.theme.accentMuted,
    "--portal-sidebar-bg": portal.theme.sidebarBg,
    "--portal-header-tint": portal.theme.headerTint,
  } as CSSProperties;

  return (
    <div
      className="min-h-screen text-gray-900"
      style={{
        ...shellStyle,
        background: `linear-gradient(180deg, ${portal.theme.headerTint} 0%, var(--background, #f9fafb) 180px)`,
      }}
      dir="rtl"
      data-portal={portalId}
    >
      <div className="flex min-h-screen">
        <PortalSidebar
          portal={portal}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <PortalHeader
            portal={portal}
            userName={userName}
            onMenuClick={() => setMobileOpen(true)}
            onLogout={() => void logout()}
            loggingOut={loggingOut}
          />
          <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
