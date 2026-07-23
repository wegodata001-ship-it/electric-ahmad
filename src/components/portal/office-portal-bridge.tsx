"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import type { PortalId } from "@/lib/portals/config";
import { portalIdForRole } from "@/lib/portals/config";

/**
 * Wraps legacy (main) office routes with the role's PortalShell
 * so deep links (/projects/…, /boq, …) stay in the portal chrome.
 */
export function OfficePortalBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const [portalId, setPortalId] = useState<PortalId | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setPortalId("project");
          return;
        }
        setPortalId(portalIdForRole(json.data?.role) ?? "project");
      })
      .catch(() => setPortalId("project"));
  }, []);

  if (!portalId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        טוען…
      </div>
    );
  }

  return <PortalShell portalId={portalId}>{children}</PortalShell>;
}
