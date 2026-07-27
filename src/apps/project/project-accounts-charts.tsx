"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DollarSign, TrendingUp, Building2, FileText } from "lucide-react";
import { Card } from "@/components/ui";
import { dashboardService } from "@/services";
import type { DashboardKPIs } from "@/types";
import { formatCurrency, formatPercent } from "@/utils/format";

const DashboardCharts = dynamic(
  () =>
    import("@/features/dashboard/components/dashboard-charts").then(
      (m) => m.DashboardCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-xl bg-gray-100" />
        <div className="h-[280px] animate-pulse rounded-xl bg-gray-100" />
      </div>
    ),
  }
);

/** חשבונות בפורטל פרויקט — גרפים וסיכומים בלבד (לא עץ workspace) */
export function ProjectAccountsCharts() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);

  useEffect(() => {
    dashboardService
      .getKPIs()
      .then(setKpis)
      .catch(() => setKpis(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">חשבונות</h1>
        <p className="mt-1 text-sm text-slate-500">
          גרפים וסיכומי ביצוע כספי — פירוט פרויקט נמצא בלחיצה על הפרויקט
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="ערך שבוצע"
          value={kpis ? formatCurrency(kpis.completedValue) : "—"}
          icon={DollarSign}
        />
        <Kpi
          label="יתרה"
          value={kpis ? formatCurrency(kpis.remainingValue) : "—"}
          icon={TrendingUp}
        />
        <Kpi
          label="התקדמות כללית"
          value={kpis ? formatPercent(kpis.overallProgress) : "—"}
          icon={Building2}
        />
        <Kpi
          label="מסמכים חדשים"
          value={kpis ? String(kpis.newDocuments) : "—"}
          icon={FileText}
        />
      </div>

      <DashboardCharts />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card padding="sm" className="sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
