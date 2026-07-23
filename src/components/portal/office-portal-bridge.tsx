"use client";

import { useEffect, useState } from "react";
import type { PortalId } from "@/lib/portals/config";
import { portalIdForRole } from "@/lib/portals/config";
import { SystemAppShell } from "@/apps/system/system-app-shell";
import { ProjectAppShell } from "@/apps/project/project-app-shell";
import { OpsAppShell } from "@/apps/operations/ops-app-shell";

/**
 * Wraps legacy (main) office routes with the role's new portal app shell
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

  if (portalId === "system") {
    return <SystemAppShell>{children}</SystemAppShell>;
  }
  if (portalId === "operations") {
    return <OpsAppShell>{children}</OpsAppShell>;
  }
  return <ProjectAppShell>{children}</ProjectAppShell>;
}
