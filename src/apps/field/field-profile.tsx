"use client";

import { usePortalSession } from "@/apps/shared/use-portal-session";
import { FieldPageHeader, field } from "@/apps/field/field-ui";

/** Minimal profile — no KPIs / attendance analytics */
export function FieldProfile() {
  const { userName, loggingOut, logout } = usePortalSession("field");

  return (
    <div className="space-y-6">
      <FieldPageHeader title="פרופיל" subtitle="מנהל עבודה" />
      <div className={field.card}>
        <p className="text-base text-[#6B7280]">שם</p>
        <p className="mt-2 text-2xl font-black text-[#111827]">
          {userName || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        disabled={loggingOut}
        className={field.btnGhost}
      >
        {loggingOut ? "…" : "יציאה מהמערכת"}
      </button>
    </div>
  );
}
