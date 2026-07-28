"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Package,
  Plus,
  Receipt,
  Table2,
  TrendingUp,
  Truck,
  User,
} from "lucide-react";
import { projectService, boqService } from "@/services";
import { apiClient } from "@/lib/api/client";
import type { Project, BoqItem } from "@/types";
import { Card, Badge, Button } from "@/components/ui";
import { formatCurrency, formatPercent, formatDate } from "@/utils/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/constants";
import { cn } from "@/lib/utils";

const DashboardCharts = dynamic(
  () =>
    import("@/features/dashboard/components/dashboard-charts").then(
      (m) => m.DashboardCharts
    ),
  { ssr: false }
);

type ProjectKPIs = {
  boqTotal: number;
  boqCompleted: number;
  boqOpen: number;
  invoicesIssued: number;
  invoicesApproved: number;
  documents: number;
  workDiaries: number;
  deliveries: number;
  exceptions: number;
  measurementSheets: number;
};

type HubData = {
  cards: {
    boq: { itemCount: number; progressPercent: number };
    performance: { reportCount: number; unitCount: number };
    invoices: { total: number; draft: number; pending: number; approved: number; invoicedAmount?: number };
    documents: { total: number; recent: number };
    workDiaries?: { total: number; lastAt: string | null };
    deliveries?: { total: number; open: number };
  };
};

export function SystemProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectService.getAll().then((list) => {
      setProjects(list);
      if (list.length > 0) setSelectedId(list[0].id);
      setLoading(false);
    });
  }, []);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    boqService.getByProject(selectedId).then(setBoqItems).catch(() => setBoqItems([]));
    apiClient
      .get<HubData>(`/api/projects/${selectedId}/hub`)
      .then(setHubData)
      .catch(() => setHubData(null));
  }, [selectedId]);

  const kpis: ProjectKPIs = useMemo(() => {
    const h = hubData?.cards;
    return {
      boqTotal: h?.boq.itemCount ?? boqItems.length,
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
    if (!selected) return [];
    return [
      {
        name: selected.name.slice(0, 20),
        completed: selected.completedValue,
        remaining: selected.contractValue - selected.completedValue,
      },
    ];
  }, [selected]);

  const progressData = useMemo(() => {
    const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני"];
    const progress = selected?.progress ?? 0;
    return months.map((month, i) => ({
      month,
      planned: Math.round(((i + 1) / 6) * 100),
      actual: Math.round(((i + 1) / 6) * progress),
    }));
  }, [selected]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-slate-500">
        טוען פרויקטים…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] gap-0 overflow-hidden" dir="rtl">
      {/* Right: Project list */}
      <aside className="w-64 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">פרויקטים</h2>
          <p className="text-[11px] text-slate-500">{projects.length} פרויקטים</p>
        </div>
        <div className="p-2 space-y-0.5">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-right transition-colors",
                selectedId === p.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p
                className={cn(
                  "text-[11px] truncate",
                  selectedId === p.id ? "text-slate-300" : "text-slate-500"
                )}
              >
                {p.contractor} · {formatPercent(p.progress)}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Center: Project dashboard */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!selected ? (
          <div className="flex min-h-[300px] items-center justify-center text-slate-400">
            בחר פרויקט מהרשימה
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Project info card */}
            <Card padding="lg" className="border-2 border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Dashboard פרויקט
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-slate-900">
                    {selected.name}
                  </h1>
                </div>
                <Badge className={PROJECT_STATUS_COLORS[selected.status]}>
                  {PROJECT_STATUS_LABELS[selected.status]}
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                <InfoField icon={User} label="לקוח" value={selected.contractor} />
                <InfoField icon={User} label="מנהל פרויקט" value={selected.foremanName || "—"} />
                <InfoField icon={TrendingUp} label="אחוז ביצוע" value={formatPercent(selected.progress)} />
                <InfoField icon={CalendarDays} label="תאריך התחלה" value={formatDate(selected.startDate)} />
                <InfoField icon={CalendarDays} label="תאריך סיום" value={formatDate(selected.endDate)} />
                <InfoField icon={BarChart3} label="סכום חוזה" value={formatCurrency(selected.contractValue)} />
                <InfoField icon={BarChart3} label="סכום שבוצע" value={formatCurrency(selected.completedValue)} />
                <InfoField
                  icon={BarChart3}
                  label="יתרה"
                  value={formatCurrency(selected.contractValue - selected.completedValue)}
                />
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-800 transition-all"
                  style={{ width: `${Math.min(100, selected.progress)}%` }}
                />
              </div>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="% ביצוע" value={formatPercent(selected.progress)} icon={TrendingUp} />
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

            {/* Charts */}
            <DashboardCharts chartData={chartData} progressData={progressData} />

            {/* BOQ detail charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MiniChart
                title="כתב כמויות"
                segments={[
                  { label: "הסתיימו", value: kpis.boqCompleted, color: "bg-emerald-500" },
                  { label: "בביצוע", value: kpis.boqOpen, color: "bg-blue-500" },
                ]}
              />
              <MiniChart
                title="חשבונות"
                segments={[
                  { label: "אושרו", value: kpis.invoicesApproved, color: "bg-emerald-500" },
                  { label: "ממתינים", value: kpis.invoicesIssued - kpis.invoicesApproved, color: "bg-amber-500" },
                ]}
              />
              <MiniChart
                title="יומן עבודה"
                segments={[
                  { label: "מולאו", value: kpis.workDiaries, color: "bg-indigo-500" },
                ]}
              />
            </div>

            {/* BOQ Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">כתב כמויות</h3>
                  <p className="text-xs text-slate-500">{boqItems.length} סעיפים</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = `/system/companies?addVariation=${selectedId}`;
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  הוסף סעיף חריג
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-right text-[11px] font-semibold text-slate-600">
                      <th className="px-4 py-2.5">מס&apos; סעיף</th>
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
                      boqItems.slice(0, 50).map((item) => (
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
                          <td className="px-4 py-2 text-slate-800">
                            {item.contractQuantity}
                          </td>
                          <td className="px-4 py-2 text-slate-800">
                            {formatCurrency(item.unitPrice)}
                          </td>
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
                {boqItems.length > 50 && (
                  <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">
                    מוצגים 50 מתוך {boqItems.length} סעיפים
                  </p>
                )}
              </div>
            </Card>

            {/* Link to project tree */}
            <Link
              href={`/project/projects/${selectedId}`}
              className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-5 py-4 text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-50"
            >
              <GitBranch className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-bold">עץ הפרויקט</p>
                <p className="text-xs text-slate-500">
                  כניסה למודולים — כתב כמויות, חשבונות, דפי מדידה, מסמכים, יומן עבודה, תעודות
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>
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

function MiniChart({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <Card padding="md">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full transition-all", seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[11px] text-slate-600">
            <span className={cn("inline-block h-2 w-2 rounded-full", seg.color)} />
            {seg.label}: {seg.value}
          </span>
        ))}
      </div>
    </Card>
  );
}
