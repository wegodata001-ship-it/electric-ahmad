"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProjectAppShell } from "@/apps/project/project-app-shell";
import { OpsAppShell } from "@/apps/operations/ops-app-shell";
import type { PortalId } from "@/lib/portals/config";
import { portalIdForRole } from "@/lib/portals/config";
import { fetchClientMe } from "@/lib/auth/client-me";

/**
 * Wraps legacy (main) office routes with the role's portal chrome.
 * Project / Operations use mobile daily-work shells — not ERP chrome.
 */
export function OfficePortalBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const [portalId, setPortalId] = useState<PortalId | null>(null);

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => {
        if (!json.success) {
          setPortalId("project");
          return;
        }
        const id = portalIdForRole(json.data?.role);
        setPortalId(id === "field" ? "project" : id ?? "project");
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

  if (portalId === "project") {
    return <ProjectAppShell>{children}</ProjectAppShell>;
  }

  if (portalId === "operations") {
    return <OpsAppShell>{children}</OpsAppShell>;
  }

  return <PortalShell portalId={portalId}>{children}</PortalShell>;
}
