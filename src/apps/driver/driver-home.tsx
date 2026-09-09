"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FilePlus2,
  Files,
  UserRound,
  LogOut,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { apiClient } from "@/lib/api/client";

export function DriverHome() {
  const { userName, loggingOut, logout } = usePortalSession("driver");
  const [counts, setCounts] = useState({ total: 0, sent: 0 });

  useEffect(() => {
    apiClient
      .get<{ items: { status: string }[] }>("/api/driver/delivery-notes")
      .then(({ items }) =>
        setCounts({
          total: items.length,
          sent: items.filter((item) =>
            ["sent_to_client", "signed", "closed"].includes(item.status)
          ).length,
        })
      )
      .catch(() => setCounts({ total: 0, sent: 0 }));
  }, []);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">
          שלום, {userName || "נהג"}
        </h1>
        <p className="mt-0.5 text-sm font-semibold text-slate-600">
          נהג משאית / שליח
        </p>
        <p className="mt-2 text-sm text-slate-500">
          המשימות והמסמכים שלך להיום
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatusCard value={counts.total} label="תעודות שלי" />
        <StatusCard value={counts.sent} label="נשלחו ללקוח" />
      </section>

      <nav className="grid gap-3">
        <HomeBtn
          href="/driver/delivery-notes/new"
          icon={FilePlus2}
          title="תעודת משלוח חדשה"
          primary
        />
        <HomeBtn
          href="/driver/delivery-notes"
          icon={Files}
          title="תעודות משלוח שלי"
          value={counts.total}
        />
        <HomeBtn
          href="/driver/profile"
          icon={UserRound}
          title="פרופיל"
        />
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-right shadow-sm transition active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <LogOut className="h-5 w-5" />
          </span>
          <span className="text-base font-black">התנתקות</span>
        </button>
      </nav>
    </div>
  );
}

function HomeBtn({
  href,
  icon: Icon,
  title,
  primary = false,
  value,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  primary?: boolean;
  value?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition active:scale-[0.99] ${
        primary
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          primary
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-800"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-base font-black">{title}</span>
      {value !== undefined && (
        <span className="text-base font-black text-slate-700">{value}</span>
      )}
      <ChevronLeft className="h-5 w-5 shrink-0 opacity-60" />
    </Link>
  );
}

function StatusCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}
