"use client";

import { useEffect, useState } from "react";
import { ProjectAppShell } from "@/apps/project/project-app-shell";
import { OpsAppShell } from "@/apps/operations/ops-app-shell";
import { SystemAppShell } from "@/apps/system/system-app-shell";
import type { PortalId } from "@/lib/portals/config";
import { portalIdForRole } from "@/lib/portals/config";
import { fetchClientMe } from "@/lib/auth/client-me";

/**
 * Wraps legacy (main) office routes with the role's portal chrome.
 *
 * Architecture (frozen):
 * - system → wide SystemAppShell (Back Office only)
 * - project / operations → narrow Portal shells (never Admin width)
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

  if (portalId === "system") {
    return <SystemAppShell>{children}</SystemAppShell>;
  }

  if (portalId === "project") {
    return <ProjectAppShell>{children}</ProjectAppShell>;
  }

  if (portalId === "operations") {
    return <OpsAppShell>{children}</OpsAppShell>;
  }

  // Fallback: treat as project portal (never wide Admin chrome)
  return <ProjectAppShell>{children}</ProjectAppShell>;
}
