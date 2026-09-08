"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  LogOut,
  Package,
  Phone,
  UserRound,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { MyDocumentsPanel } from "@/apps/shared/my-documents-panel";
import { FieldPageHeader } from "@/apps/field/field-ui";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";

/** Compact field profile without duplicate top-level tabs. */
export function FieldProfile() {
  const { userName, loggingOut, logout } = usePortalSession("field");
  const [dashboard, setDashboard] = useState<FieldDashboard | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);

  useEffect(() => {
    fieldService
      .getDashboard()
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, []);

  return (
    <div className="space-y-5">
      <FieldPageHeader title="פרופיל" subtitle="מנהל עבודה" />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
            <UserRound className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-black text-slate-950">
              {dashboard?.foreman.name || userName || "מנהל עבודה"}
            </p>
            <p className="text-sm text-slate-500">מנהל עבודה</p>
          </div>
        </div>
        {dashboard?.foreman.phone && (
          <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <Phone className="h-4 w-4" />
            <span dir="ltr">{dashboard.foreman.phone}</span>
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black text-slate-700">הפעילות שלי</h2>
        <div className="grid gap-2.5">
          <ProfileLink
            href="/field/work-diaries"
            icon={BookOpen}
            label="יומני העבודה שלי"
          />
          <ProfileLink
            href="/field/delivery-notes"
            icon={Package}
            label="תעודות המשלוח שלי"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black text-slate-700">המסמכים שלי</h2>
        <button
          type="button"
          onClick={() => setShowDocuments((current) => !current)}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-right font-bold text-slate-900"
        >
          <FolderOpen className="h-5 w-5 text-blue-800" />
          <span className="flex-1">מסמכים PDF</span>
          {showDocuments ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {showDocuments && (
          <div className="mt-3">
            <MyDocumentsPanel apiPath="/api/field/my-documents" />
          </div>
        )}
      </section>

      <section className="border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-black text-slate-700">חשבון</p>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 font-bold text-red-700 disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" />
          {loggingOut ? "יוצא…" : "יציאה מהמערכת"}
        </button>
      </section>
    </div>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-900"
    >
      <Icon className="h-5 w-5 text-blue-800" />
      {label}
    </Link>
  );
}
