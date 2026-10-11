"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, HardHat, Receipt, Ruler } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import {
  ErrorState,
  KpiCard,
  PortalCard,
  PortalPage,
  SkeletonGrid,
  StatusPill,
  moneyText,
} from "@/apps/subcontractor/portal-ui";
import { WORK_STATUS_COLORS, WORK_STATUS_LABELS } from "@/lib/subcontractors/constants";
import { cn } from "@/lib/utils";

type Home = {
  companyName: string;
  canViewFinance: boolean;
  assignments: Array<{
    id: string;
    projectName: string;
    workSiteName: string | null;
    description: string;
    workStatus: string;
    workStatusLabel: string;
    startDate: string | null;
  }>;
  measurements: Array<{ id: string; status: string; createdAt: string }>;
  accounts: Array<{ id: string; status: string; createdAt: string }>;
  payments: Array<{ id: string; amount: number; paidAt: string }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    link?: string | null;
  }>;
  finance: {
    approvedPayable: number;
  } | null;
};

export default function Page() {
  const { userName, companyName } = usePortalSession("subcontractor");
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState("");
  const displayName =
    companyName && !/portal-|@|cm[a-z0-9]{8}/i.test(companyName)
      ? companyName
      : userName || data?.companyName || "קבלן משנה";

  function load() {
    apiClient
      .get<Home>("/api/subcontractor/home")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<Home>("/api/subcontractor/home")
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const active = data.assignments.filter((a) =>
      ["assigned", "in_progress", "returned"].includes(a.workStatus)
    );
    const pending = data.assignments.filter((a) => a.workStatus === "submitted");
    const pendingMeasures = data.measurements.filter((m) =>
      ["submitted", "in_review"].includes(m.status)
    );
    return {
      active,
      pendingCount: pending.length,
      pendingMeasures: pendingMeasures.length,
    };
  }, [data]);

  const activity = useMemo(() => {
    if (!data) return [];
    return [...data.notifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  }, [data]);

  if (error && !data) {
    return <ErrorState message={error} onRetry={load} />;
  }
  if (!data || !stats) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <PortalPage title={`שלום, ${displayName}`} subtitle="סיכום הפעילות שלך בפרויקטים">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="עבודות פעילות" value={String(stats.active.length)} tone="brand" />
        <KpiCard
          label="עבודות ממתינות לאישור"
          value={String(stats.pendingCount)}
          tone="warning"
        />
        <KpiCard
          label="מדידות ממתינות"
          value={String(stats.pendingMeasures)}
          tone="warning"
        />
        {data.canViewFinance && data.finance ? (
          <KpiCard
            label="יתרה מאושרת לתשלום"
            value={moneyText(data.finance.approvedPayable)}
            hint="חשבונות מאושרים פחות תשלומים שנרשמו"
            tone="success"
          />
        ) : (
          <KpiCard label="העבודות שלי" value={String(data.assignments.length)} />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PortalCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-black">העבודות שלי</h2>
            <Link href="/subcontractor/works" className="text-xs font-bold text-[#C8102E]">
              לכל העבודות
            </Link>
          </div>
          {stats.active.length === 0 && (
            <p className="text-sm text-[#5B6470]">לא הוקצו לך עבודות כרגע</p>
          )}
          <div className="space-y-3">
            {stats.active.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[#E6E8EB] bg-[#F8F8F8] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{a.projectName}</p>
                    <p className="text-sm text-[#5B6470]">
                      {a.workSiteName || "ללא סניף"} · {a.description}
                    </p>
                    <p className="mt-1 text-[11px] text-[#5B6470]">
                      {a.startDate?.slice(0, 10) || "ללא תאריך התחלה"}
                    </p>
                  </div>
                  <StatusPill
                    label={a.workStatusLabel || WORK_STATUS_LABELS[a.workStatus]}
                    className={WORK_STATUS_COLORS[a.workStatus]}
                  />
                </div>
                <Link
                  href={`/subcontractor/works/${a.id}`}
                  className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#C8102E] px-3 text-xs font-bold text-white"
                >
                  פתח עבודה
                </Link>
              </div>
            ))}
          </div>
        </PortalCard>

        <div className="space-y-4">
          <PortalCard>
            <h2 className="mb-3 font-black">פעולות מהירות</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Quick href="/subcontractor/works" icon={HardHat} label="העבודות שלי" />
              <Quick href="/subcontractor/reports" icon={BookOpen} label="שליחת דיווח" />
              <Quick href="/subcontractor/measurements" icon={Ruler} label="המדידות שלי" />
              {data.canViewFinance && (
                <Quick href="/subcontractor/finance" icon={Receipt} label="החשבונות שלי" />
              )}
            </div>
          </PortalCard>
          <PortalCard>
            <h2 className="mb-3 font-black">פעילות אחרונה</h2>
            {activity.length === 0 && (
              <p className="text-sm text-[#5B6470]">אין פעילות אחרונה להצגה</p>
            )}
            <div className="space-y-3">
              {activity.map((n) => (
                <div key={n.id} className="border-b border-[#E6E8EB] pb-2 last:border-0">
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="text-xs text-[#5B6470]">{n.message}</p>
                  <p className="mt-1 text-[11px] text-[#5B6470]">{n.createdAt.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>
      </div>
    </PortalPage>
  );
}

function Quick({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof HardHat;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-xl border border-[#E6E8EB] bg-white px-3 text-sm font-bold"
      )}
    >
      <Icon className="h-4 w-4 text-[#C8102E]" />
      {label}
    </Link>
  );
}
