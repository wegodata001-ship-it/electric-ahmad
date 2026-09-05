"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FolderOpen, Package } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { MyDocumentsPanel } from "@/apps/shared/my-documents-panel";
import { FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

/** Profile + my documents tab */
export function FieldProfile() {
  const { userName, loggingOut, logout } = usePortalSession("field");
  const [tab, setTab] = useState<"info" | "docs">("info");

  return (
    <div className="space-y-6">
      <FieldPageHeader title="פרופיל" subtitle="מנהל עבודה" />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("info")}
          className={cn(
            "min-h-12 rounded-2xl text-sm font-black",
            tab === "info"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700"
          )}
        >
          פרטים
        </button>
        <button
          type="button"
          onClick={() => setTab("docs")}
          className={cn(
            "min-h-12 rounded-2xl text-sm font-black",
            tab === "docs"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700"
          )}
        >
          📁 המסמכים שלי
        </button>
      </div>

      {tab === "docs" ? (
        <MyDocumentsPanel apiPath="/api/field/my-documents" />
      ) : (
        <>
          <div className={field.card}>
            <p className="text-base text-[#6B7280]">שם</p>
            <p className="mt-2 text-2xl font-black text-[#111827]">
              {userName || "—"}
            </p>
          </div>

          <div className="grid gap-3">
            <Link
              href="/field/work-diaries"
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold"
            >
              <BookOpen className="h-5 w-5" />
              היומנים שלי
            </Link>
            <Link
              href="/field/delivery-notes"
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold"
            >
              <Package className="h-5 w-5" />
              תעודות המשלוח שלי
            </Link>
            <button
              type="button"
              onClick={() => setTab("docs")}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-right font-bold"
            >
              <FolderOpen className="h-5 w-5" />
              המסמכים שלי (PDF)
            </button>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className={field.btnGhost}
          >
            {loggingOut ? "…" : "יציאה מהמערכת"}
          </button>
        </>
      )}
    </div>
  );
}
