"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  Plus,
  Receipt,
  Table2,
  TrendingUp,
  Truck,
  User,
} from "lucide-react";
import { boqService, projectService } from "@/services";
import { apiClient } from "@/lib/api/client";
import type { BoqItem, Project } from "@/types";
import { Badge, Button, Card } from "@/components/ui";
import { formatCurrency, formatDate, formatPercent } from "@/utils/format";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from "@/constants";

const DashboardCharts = dynamic(
  () =>
    import("@/features/dashboard/components/dashboard-charts").then(
      (m) => m.DashboardCharts
    ),
  { ssr: false }
);

type HubData = {
  cards: {
    boq: { itemCount: number; progressPercent: number };
    performance: { reportCount: number; unitCount: number };
    invoices: {
      total: number;
      draft: number;
      pending: number;
      approved: number;
      invoicedAmount?: number;
    };
    documents: { total: number; recent: number };
    workDiaries?: { total: number; lastAt: string | null };
    deliveries?: { total: number; open: number };
  };
};

/** Dashboard של פרויקט יחיד — בלי רשימת פרויקטים (לשיבוץ בתוך Admin Workspace) */
export function ProjectDashboardPanel({
  projectId,
  onAddVariation,
}: {
  projectId: string;
  onAddVariation?: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      projectService.getById(projectId),
      boqService.getByProject(projectId).catch(() => [] as BoqItem[]),
      apiClient
        .get<HubData>(`/api/projects/${projectId}/hub`)
        .catch(() => null),
    ])
      .then(([p, boq, hub]) => {
        if (cancelled) return;
        setProject(p ?? null);
        setBoqItems(boq);
        setHubData(hub);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const kpis = useMemo(() => {
    const h = hubData?.cards;
    return {
      boqCompleted: boqItems.filter((i) => i.status === "completed").length,
      boqOpen: boqItems.filter((i) => i.status !== "completed").length,
      invoicesIssued: h?.invoices.total ?? 0,
      invoicesApproved: h?.invoices.approved ?? 0,
      documents: h?.documents.total ?? 0,
      workDiaries: h?.workDiaries?.total ?? 0,
      deliveries: h?.deliveries?.total ?? 0,
      exceptions: boqItems.filter((i) => i.itemKind === "exceptional").length,
      measurementSheets: h?.performance.reportCount ?? 0,
    };
  }, [hubData, boqItems]);

  const chartData = useMemo(() => {
    if (!project) return [];
    return [
      {
        name: project.name.slice(0, 20),
        completed: project.completedValue,
        remaining: Math.max(0, project.contractValue - project.completedValue),
      },
    ];
  }, [project]);

  const progressData = useMemo(() => {
    const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני"];
    const progress = project?.progress ?? 0;
    return months.map((month, i) => ({
      month,
      planned: Math.round(((i + 1) / 6) * 100),
      actual: Math.round(((i + 1) / 6) * progress),
    }));
  }, [project]);

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-slate-400">
        טוען סיכום פרויקט…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-sm text-red-600">
        לא נמצא פרויקט
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className="border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              סיכום פרויקט
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              {project.name}
            </h1>
          </div>
          <Badge className={PROJECT_STATUS_COLORS[project.status]}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <InfoField icon={User} label="לקוח" value={project.contractor} />
          <InfoField
            icon={User}
            label="מנהל פרויקט"
            value={project.foremanName || "—"}
          />
          <InfoField
            icon={TrendingUp}
            label="אחוז ביצוע"
            value={formatPercent(project.progress)}
          />
          <InfoField
            icon={CalendarDays}
            label="תאריך התחלה"
            value={formatDate(project.startDate)}
          />
          <InfoField
            icon={CalendarDays}
            label="תאריך סיום"
            value={formatDate(project.endDate)}
          />
          <InfoField
            icon={BarChart3}
            label="סכום חוזה"
            value={formatCurrency(project.contractValue)}
          />
          <InfoField
            icon={BarChart3}
            label="סכום שבוצע"
            value={formatCurrency(project.completedValue)}
          />
          <InfoField
            icon={BarChart3}
            label="יתרה"
            value={formatCurrency(
              Math.max(0, project.contractValue - project.completedValue)
            )}
          />
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-800 transition-all"
            style={{ width: `${Math.min(100, project.progress)}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="% ביצוע" value={formatPercent(project.progress)} icon={TrendingUp} />
        <KpiCard label="סעיפים שבוצעו" value={String(kpis.boqCompleted)} icon={CheckCircle2} />
        <KpiCard label="סעיפים פתוחים" value={String(kpis.boqOpen)} icon={ClipboardList} />
        <KpiCard label="דפי מדידה" value={String(kpis.measurementSheets)} icon={Table2} />
        <KpiCard label="חשבונות שהופקו" value={String(kpis.invoicesIssued)} icon={Receipt} />
        <KpiCard label="חשבונות שאושרו" value={String(kpis.invoicesApproved)} icon={CheckCircle2} />
        <KpiCard label="מסמכים" value={String(kpis.documents)} icon={FileText} />
        <KpiCard label="יומני עבודה" value={String(kpis.workDiaries)} icon={Package} />
        <KpiCard label="חריגים" value={String(kpis.exceptions)} icon={BarChart3} />
        <KpiCard label="תעודות משלוח" value={String(kpis.deliveries)} icon={Truck} />
      </div>

      <DashboardCharts chartData={chartData} progressData={progressData} />

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">כתב כמויות</h3>
            <p className="text-xs text-slate-500">{boqItems.length} סעיפים · לקריאה</p>
          </div>
          {onAddVariation && (
            <Button size="sm" onClick={onAddVariation}>
              <Plus className="h-3.5 w-3.5" />
              הוסף סעיף חריג
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-right text-[11px] font-semibold text-slate-600">
                <th className="px-4 py-2.5">מס׳ סעיף</th>
                <th className="px-4 py-2.5">תיאור</th>
                <th className="px-4 py-2.5">יחידה</th>
                <th className="px-4 py-2.5">כמות</th>
                <th className="px-4 py-2.5">מחיר</th>
                <th className="px-4 py-2.5">ביצוע</th>
                <th className="px-4 py-2.5">יתרה</th>
              </tr>
            </thead>
            <tbody>
              {boqItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    אין סעיפים בפרויקט זה
                  </td>
                </tr>
              ) : (
                boqItems.slice(0, 40).map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {item.code}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-slate-800">
                      {item.description}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                    <td className="px-4 py-2">{item.contractQuantity}</td>
                    <td className="px-4 py-2">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2 font-semibold text-blue-700">
                      {item.executedQuantity}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {item.remainingQuantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="truncate font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      </div>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}
