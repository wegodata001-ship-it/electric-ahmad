"use client";

import { useState } from "react";
import { FileText, LogOut, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { MyDocumentsPanel } from "@/apps/shared/my-documents-panel";

export function DriverProfile() {
  const { userName, username, loggingOut, logout } =
    usePortalSession("driver");
  const [showDocuments, setShowDocuments] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-slate-950">פרופיל</h1>
        <p className="mt-1 text-sm text-slate-500">פרטי החשבון שלך</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <UserRound className="h-5 w-5" />
          </span>
          <h2 className="font-black text-slate-950">פרטי נהג</h2>
        </div>
        <InfoRow label="שם" value={userName || "—"} />
        <InfoRow label="תפקיד" value="נהג משאית / שליח" />
        <InfoRow label="שם משתמש" value={username || "—"} last />
      </section>

      <button
        type="button"
        onClick={() => setShowDocuments((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-right font-black text-slate-900 shadow-sm"
      >
        <FileText className="h-5 w-5 text-slate-600" />
        <span className="flex-1">המסמכים שלי</span>
        <span className="text-xs text-slate-400">
          {showDocuments ? "סגור" : "פתח"}
        </span>
      </button>

      {showDocuments && (
        <MyDocumentsPanel apiPath="/api/driver/my-documents" />
      )}

      <button
        type="button"
        disabled={loggingOut}
        onClick={() => void logout()}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-black text-white disabled:opacity-60"
      >
        <LogOut className="h-5 w-5" />
        התנתקות
      </button>
    </div>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`py-3 ${last ? "" : "border-b border-slate-100"}`}>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
