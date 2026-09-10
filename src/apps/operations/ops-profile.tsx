"use client";

import { usePortalSession } from "@/apps/shared/use-portal-session";

export function OpsProfile() {
  const { userName } = usePortalSession("operations");

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-black">פרופיל</h1>
        <p className="mt-1 text-sm text-stone-500">מנהל תפעול</p>
      </section>

      <div className="rounded-3xl border-2 border-amber-200 bg-white p-5">
        <p className="text-sm text-stone-500">שם</p>
        <p className="mt-1 text-xl font-black">{userName || "—"}</p>
      </div>
    </div>
  );
}
