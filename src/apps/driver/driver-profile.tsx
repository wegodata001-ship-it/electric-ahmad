"use client";

import { useState } from "react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { MyDocumentsPanel } from "@/apps/shared/my-documents-panel";
import { cn } from "@/lib/utils";

export function DriverProfile() {
  const { userName, role, loggingOut, logout } = usePortalSession("driver");
  const [tab, setTab] = useState<"info" | "docs">("info");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black">פרופיל</h1>

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
        <MyDocumentsPanel apiPath="/api/driver/my-documents" />
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">שם</p>
            <p className="text-lg font-bold text-slate-900">{userName}</p>
            <p className="mt-3 text-xs text-slate-400">תפקיד</p>
            <p className="font-semibold text-slate-700">נהג משאית / שליח</p>
            {role && (
              <p className="mt-1 font-mono text-[10px] text-slate-400">{role}</p>
            )}
          </div>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="w-full min-h-[3.5rem] rounded-3xl bg-slate-900 text-base font-black text-white"
          >
            התנתקות
          </button>
        </>
      )}
    </div>
  );
}
