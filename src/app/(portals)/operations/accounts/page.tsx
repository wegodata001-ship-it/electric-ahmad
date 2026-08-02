"use client";

import { AdminProjectWorkspace } from "@/apps/system/admin-project-workspace";

/**
 * Operations Manager home — same Project Tree workspace as System Admin.
 * Permissions (no send-to-client) enforced separately in FE + BE.
 */
export default function Page() {
  return (
    <AdminProjectWorkspace
      basePath="/operations/accounts"
      storageKey="ops-project-workspace-v1"
    />
  );
}
