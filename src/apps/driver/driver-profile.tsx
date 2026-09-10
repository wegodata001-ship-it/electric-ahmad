"use client";

import { useState } from "react";
import { FileText, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { MyDocumentsPanel } from "@/apps/shared/my-documents-panel";

export function DriverProfile() {
  const { userName, username } = usePortalSession("driver");
  const [showDocuments, setShowDocuments] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-[#0F172A]">פרופיל</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">פרטי החשבון שלך</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[#DCE4EF] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center gap-3 border-b border-[#E8EEF6] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <UserRound className="h-5 w-5" />
          </span>
          <h2 className="font-black text-[#0F172A]">פרטי נהג</h2>
        </div>
        <InfoRow label="שם" value={userName || "—"} />
        <InfoRow label="תפקיד" value="נהג משאית / שליח" />
        <InfoRow label="שם משתמש" value={username || "—"} last />
      </section>

      <button
        type="button"
        onClick={() => setShowDocuments((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#DCE4EF] bg-white px-4 text-right font-black text-[#0F172A] shadow-[0_2px_8px_rgba(15,23,42,0.05)]"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFF7ED] text-[#EA580C]">
          <FileText className="h-4 w-4" />
        </span>
        <span className="flex-1">המסמכים שלי</span>
        <span className="text-xs text-[#64748B]">
          {showDocuments ? "סגור" : "פתח"}
        </span>
      </button>

      {showDocuments && (
        <MyDocumentsPanel apiPath="/api/driver/my-documents" />
      )}
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
    <div className={`py-3 ${last ? "" : "border-b border-[#E8EEF6]"}`}>
      <p className="text-xs font-semibold text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#0F172A]">{value}</p>
    </div>
  );
}
