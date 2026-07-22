"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Minus,
  Package,
  Receipt,
  Table2,
  Truck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Badge, Button } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from "@/utils/format";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from "@/constants";
import type { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

type HubData = {
  project: {
    id: string;
    name: string;
    contractNumber: string;
    contractor: string;
    location: string;
    status: ProjectStatus;
    progress: number;
    contractValue: number;
    completedValue: number;
    invoicedValue: number;
    foremanName?: string;
    axisLabel: string;
  };
  cards: {
    boq: {
      itemCount: number;
      completedQuantity?: number;
      progressPercent: number;
    };
    performance: {
      unitCount: number;
      sheetCount?: number;
      reportCount: number;
      lastReportAt?: string | null;
    };
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

type ModuleNode = {
  id: string;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
  lines: string[];
};

/** בית הפרויקט — עץ ניווט בלבד (לא רשימת פרויקטים, לא מסך חשבונות) */
export function ProjectTreeHubPage({ projectId }: { projectId: string }) {
  const [hub, setHub] = useState<HubData | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    apiClient
      .get<HubData>(`/api/projects/${projectId}/hub`)
      .then(setHub)
      .catch((e) => setError(e.message));
  }, [projectId]);

  const modules: ModuleNode[] = useMemo(() => {
    if (!hub) return [];
    const c = hub.cards;
    const id = projectId;
    return [
      {
        id: "boq",
        title: "כתב כמויות",
        href: `/boq?projectId=${id}`,
        icon: ClipboardList,
        accent:
          "border-sky-300 hover:border-sky-500 bg-gradient-to-b from-sky-50 to-white",
        iconBg: "bg-sky-600",
        lines: [
          `${c.boq.itemCount} סעיפים`,
          c.boq.completedQuantity != null
            ? `בוצע: ${Math.round(c.boq.completedQuantity)}`
            : "",
          `${formatPercent(c.boq.progressPercent)} ביצוע`,
        ].filter(Boolean),
      },
      {
        id: "performance",
        title: "דוחות ביצוע",
        href: `/projects/${id}/performance`,
        icon: Table2,
        accent:
          "border-violet-300 hover:border-violet-500 bg-gradient-to-b from-violet-50 to-white",
        iconBg: "bg-violet-600",
        lines: [
          `${c.performance.reportCount} דיווחים`,
          `${c.performance.unitCount} ${hub.project.axisLabel}`,
          c.performance.lastReportAt
            ? `אחרון: ${formatDate(c.performance.lastReportAt)}`
            : "אין דיווח עדיין",
        ],
      },
      {
        id: "invoices",
        title: "חשבונות",
        href: `/projects/${id}/invoices`,
        icon: Receipt,
        accent:
          "border-emerald-300 hover:border-emerald-500 bg-gradient-to-b from-emerald-50 to-white",
        iconBg: "bg-emerald-600",
        lines: [
          `${c.invoices.total} חשבונות`,
          `${c.invoices.draft} טיוטות · ${c.invoices.pending} ממתינים`,
          `${c.invoices.approved} מאושרים`,
          c.invoices.invoicedAmount != null
            ? `חויב: ${formatCurrency(c.invoices.invoicedAmount)}`
            : "",
        ].filter(Boolean),
      },
      {
        id: "documents",
        title: "מסמכים",
        href: `/projects/${id}/documents`,
        icon: FileText,
        accent:
          "border-amber-300 hover:border-amber-500 bg-gradient-to-b from-amber-50 to-white",
        iconBg: "bg-amber-600",
        lines: [
          `${c.documents.total} מסמכים`,
          c.documents.recent
            ? `${c.documents.recent} חדשים השבוע`
            : "אין חדשים",
        ],
      },
      {
        id: "workDiaries",
        title: "יומן עבודה",
        href: `/documents-archive`,
        icon: Package,
        accent:
          "border-indigo-300 hover:border-indigo-500 bg-gradient-to-b from-indigo-50 to-white",
        iconBg: "bg-indigo-600",
        lines: [
          `${c.workDiaries?.total ?? 0} ימי עבודה`,
          c.workDiaries?.lastAt
            ? `אחרון: ${formatDate(c.workDiaries.lastAt)}`
            : "אין דיווח",
        ],
      },
      {
        id: "deliveries",
        title: "תעודות משלוח",
        href: `/delivery-notes`,
        icon: Truck,
        accent:
          "border-orange-300 hover:border-orange-500 bg-gradient-to-b from-orange-50 to-white",
        iconBg: "bg-orange-600",
        lines: [
          `${c.deliveries?.total ?? 0} תעודות`,
          `${c.deliveries?.open ?? 0} פתוחות`,
        ],
      },
    ];
  }, [hub, projectId]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  function onPointerUp() {
    dragging.current = false;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
        <Link
          href="/projects"
          className="mt-2 inline-block text-sm text-primary-700"
        >
          חזרה לפרויקטים
        </Link>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const { project } = hub;

  return (
    <div className="space-y-3 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowRight className="h-4 w-4" />
          כל הפרויקטים
        </Link>
        <div className="hidden items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 sm:flex">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-gray-50"
            onClick={() => setZoom((z) => Math.max(0.55, z - 0.1))}
            aria-label="הקטן"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs text-gray-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-gray-50"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            aria-label="הגדל"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-gray-50"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="איפוס"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="space-y-3 md:hidden">
        <RootCard project={project} />
        <div className="mx-auto h-6 w-px bg-slate-300" />
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleCard key={m.id} node={m} />
          ))}
        </div>
      </div>

      {/* Desktop: ownership-style tree */}
      <div
        className="relative hidden min-h-[640px] overflow-hidden rounded-3xl border border-gray-200 bg-[radial-gradient(ellipse_at_top,_#f1f5f9_0%,_#f8fafc_50%,_#eef2f7_100%)] cursor-grab active:cursor-grabbing md:block"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="origin-top px-6 py-10"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div className="mx-auto max-w-5xl">
            <div className="flex justify-center">
              <RootCard project={project} large />
            </div>

            <TreeConnectors count={3} />

            <div className="grid grid-cols-3 gap-4">
              {modules.slice(0, 3).map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <ModuleCard node={m} />
                </motion.div>
              ))}
            </div>

            <TreeConnectors count={3} />

            <div className="grid grid-cols-3 gap-4">
              {modules.slice(3, 6).map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.12 }}
                >
                  <ModuleCard node={m} />
                </motion.div>
              ))}
            </div>

            {modules[6] && (
              <>
                <div className="relative mx-auto h-10 w-full max-w-xs">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <line
                      x1="50"
                      y1="0"
                      x2="50"
                      y2="40"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div className="mx-auto max-w-[220px]">
                  <ModuleCard node={modules[6]} />
                </div>
              </>
            )}
          </div>
        </motion.div>
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-gray-400">
          גרור להזזה · זום בכפתורים למעלה
        </p>
      </div>
    </div>
  );
}

function TreeConnectors({ count }: { count: number }) {
  const pads = 40;
  const usable = 1000 - pads * 2;
  const xs =
    count <= 1
      ? [500]
      : Array.from(
          { length: count },
          (_, i) => pads + (usable * i) / (count - 1)
        );

  return (
    <div className="relative mx-auto h-14 w-full max-w-5xl">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 56"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line x1="500" y1="0" x2="500" y2="20" stroke="#94a3b8" strokeWidth="1.5" />
        <line
          x1={xs[0]}
          y1="20"
          x2={xs[xs.length - 1]}
          y2="20"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        {xs.map((x) => (
          <line
            key={x}
            x1={x}
            y1="20"
            x2={x}
            y2="56"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  );
}

function RootCard({
  project,
  large,
}: {
  project: HubData["project"];
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-slate-300 bg-white shadow-md shadow-slate-200/60",
        large ? "w-full max-w-xl px-6 py-5" : "w-full px-4 py-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            בית הפרויקט
          </p>
          <h1
            className={cn(
              "font-bold text-slate-900",
              large ? "text-xl sm:text-2xl" : "text-lg"
            )}
          >
            {project.name}
          </h1>
        </div>
        <Badge className={PROJECT_STATUS_COLORS[project.status]}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Meta label="מספר פרויקט" value={project.contractNumber} />
        <Meta label="לקוח" value={project.contractor} />
        <Meta label="מנהל פרויקט" value={project.foremanName || "—"} />
        <Meta label="התקדמות" value={formatPercent(project.progress)} />
        <Meta label="סכום חוזה" value={formatCurrency(project.contractValue)} />
        <Meta label="שבוצע" value={formatCurrency(project.completedValue)} />
        <Meta label="שחויב" value={formatCurrency(project.invoicedValue)} />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-700 transition-all"
          style={{ width: `${Math.min(100, project.progress)}%` }}
        />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ModuleCard({ node }: { node: ModuleNode }) {
  const Icon = node.icon;
  return (
    <Link
      href={node.href}
      className={cn(
        "group block w-full rounded-xl border-2 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        node.accent
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
            node.iconBg
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{node.title}</p>
          {node.lines.map((line) => (
            <p
              key={line}
              className="mt-0.5 text-[11px] leading-snug text-slate-600"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </Link>
  );
}
