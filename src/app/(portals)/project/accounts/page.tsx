"use client";

import { AdminProjectWorkspace } from "@/apps/system/admin-project-workspace";

/**
 * Project Manager home — same tree as System/Ops.
 * Tree shows assigned projects only; diaries/deliveries can switch to any project.
 */
export default function Page() {
  return (
    <AdminProjectWorkspace
      basePath="/project/accounts"
      storageKey="pm-project-workspace-v1"
      projectScope="assigned"
    />
  );
}
