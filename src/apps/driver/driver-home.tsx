"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FilePlus2, Files, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { apiClient } from "@/lib/api/client";

export function DriverHome() {
  const { userName } = usePortalSession("driver");
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
        <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">
          שלום, {userName || "נהג"}
        </h1>
        <p className="mt-0.5 text-sm font-semibold text-[#64748B]">
          נהג משאית / שליח
        </p>
        <p className="mt-2 text-sm text-[#64748B]">
          המשימות והמסמכים שלך להיום
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatusCard value={counts.total} label="תעודות שלי" tone="orange" />
        <StatusCard value={counts.sent} label="נשלחו ללקוח" tone="green" />
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
        <HomeBtn href="/driver/profile" icon={UserRound} title="פרופיל" />
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
      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition active:scale-[0.99] ${
        primary
          ? "border-[#059669] bg-[#059669] text-white"
          : "border-[#DCE4EF] bg-white text-[#0F172A]"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          primary ? "bg-white/15 text-white" : "bg-[#EFF6FF] text-[#2563EB]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-base font-black">{title}</span>
      {value !== undefined && (
        <span className="text-base font-black text-[#64748B]">{value}</span>
      )}
      <ChevronLeft className="h-5 w-5 shrink-0 opacity-60" />
    </Link>
  );
}

function StatusCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "orange" | "green";
}) {
  const iconBg =
    tone === "orange" ? "border-t-[#EA580C]" : "border-t-[#059669]";
  return (
    <div
      className={`rounded-2xl border border-[#DCE4EF] border-t-2 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] ${iconBg}`}
    >
      <p className="text-2xl font-black text-[#0F172A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#64748B]">{label}</p>
    </div>
  );
}
