"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Package,
  Receipt,
  Table2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectModuleId =
  | "summary"
  | "boq"
  | "performance"
  | "invoices"
  | "billing"
  | "documents"
  | "workDiaries"
  | "deliveries"
  | "reports";

export type ProjectNavTreeStats = {
  boqCount?: number;
  sheetCount?: number;
  invoiceCount?: number;
  documentCount?: number;
  workDiaryCount?: number;
  deliveryCount?: number;
};

type ModuleNode = {
  id: ProjectModuleId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
  lines: (stats?: ProjectNavTreeStats) => string[];
};

/** Default modules for the invoices / accounts workspace graph */
export const DEFAULT_PROJECT_MODULE_IDS: ProjectModuleId[] = [
  "boq",
  "performance",
  "invoices",
  "documents",
  "workDiaries",
  "deliveries",
];

/** Full module set used by System / Ops / Project Manager accounts tree */
export const ADMIN_PROJECT_MODULE_IDS: ProjectModuleId[] = [
  "summary",
  "boq",
  "performance",
  "invoices",
  "billing",
  "deliveries",
  "workDiaries",
  "documents",
  "reports",
];

const ALL_MODULES: ModuleNode[] = [
  {
    id: "summary",
    title: "סיכום פרויקט",
    icon: LayoutDashboard,
    accent:
      "border-slate-300 bg-gradient-to-b from-slate-50 to-white hover:border-slate-500",
    iconBg: "bg-slate-700",
    lines: () => ["לוח בקרה"],
  },
  {
    id: "boq",
    title: "כתב כמויות",
    icon: ClipboardList,
    accent:
      "border-sky-300 bg-gradient-to-b from-sky-50 to-white hover:border-sky-500",
    iconBg: "bg-sky-600",
    lines: (s) => [`${s?.boqCount ?? 0} סעיפים`],
  },
  {
    id: "performance",
    title: "דפי מדידה",
    icon: Table2,
    accent:
      "border-violet-300 bg-gradient-to-b from-violet-50 to-white hover:border-violet-500",
    iconBg: "bg-violet-600",
    lines: (s) => [`${s?.sheetCount ?? 0} דפי מדידה`],
  },
  {
    id: "invoices",
    title: "חשבונות",
    icon: Receipt,
    accent:
      "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white hover:border-emerald-500",
    iconBg: "bg-emerald-600",
    lines: (s) => [`${s?.invoiceCount ?? 0} חשבונות`],
  },
  {
    id: "billing",
    title: "חשבוניות",
    icon: FileSpreadsheet,
    accent:
      "border-teal-300 bg-gradient-to-b from-teal-50 to-white hover:border-teal-500",
    iconBg: "bg-teal-600",
    lines: () => ["מסמכי חיוב"],
  },
  {
    id: "documents",
    title: "מסמכים",
    icon: FolderOpen,
    accent:
      "border-amber-300 bg-gradient-to-b from-amber-50 to-white hover:border-amber-500",
    iconBg: "bg-amber-600",
    lines: (s) => [`${s?.documentCount ?? 0} קבצים`],
  },
  {
    id: "workDiaries",
    title: "יומן עבודה",
    icon: Package,
    accent:
      "border-indigo-300 bg-gradient-to-b from-indigo-50 to-white hover:border-indigo-500",
    iconBg: "bg-indigo-600",
    lines: (s) => [`${s?.workDiaryCount ?? 0} ימי עבודה`],
  },
  {
    id: "deliveries",
    title: "תעודות משלוח",
    icon: Truck,
    accent:
      "border-orange-300 bg-gradient-to-b from-orange-50 to-white hover:border-orange-500",
    iconBg: "bg-orange-600",
    lines: (s) => [`${s?.deliveryCount ?? 0} תעודות`],
  },
  {
    id: "reports",
    title: "דוחות",
    icon: BarChart3,
    accent:
      "border-rose-300 bg-gradient-to-b from-rose-50 to-white hover:border-rose-500",
    iconBg: "bg-rose-600",
    lines: () => ["סיכומי ביצוע"],
  },
];

type Props = {
  projectName: string;
  activeModule: ProjectModuleId | null;
  onSelect: (id: ProjectModuleId) => void;
  stats?: ProjectNavTreeStats;
  /** Which nodes to show; defaults to the classic 6-module invoices tree */
  moduleIds?: ProjectModuleId[];
};

export function ProjectModulesNavTree({
  projectName,
  activeModule,
  onSelect,
  stats,
  moduleIds = DEFAULT_PROJECT_MODULE_IDS,
}: Props) {
  const modules = moduleIds
    .map((id) => ALL_MODULES.find((m) => m.id === id))
    .filter((m): m is ModuleNode => Boolean(m));

  const rows = chunkModules(modules, modules.length > 6 ? 3 : 4);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#f1f5f9_100%)] p-3 sm:p-5"
      dir="rtl"
      data-project-tree="graph"
    >
      {/* Mobile: stacked large tap targets */}
      <div className="space-y-2 md:hidden">
        <Root projectName={projectName} compact />
        <div className="mx-auto h-4 w-px bg-slate-300" />
        <div className="grid grid-cols-1 gap-2">
          {modules.map((m) => (
            <ModuleButton
              key={m.id}
              node={m}
              stats={stats}
              active={activeModule === m.id}
              onSelect={onSelect}
              large
            />
          ))}
        </div>
      </div>

      {/* Desktop: ownership tree graph */}
      <div className="hidden md:block">
        <div className="flex justify-center">
          <Root projectName={projectName} />
        </div>

        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`}>
            <Connector count={row.length} />
            <div
              className={cn(
                "grid gap-3 px-1",
                row.length === 1 && "mx-auto max-w-[220px] grid-cols-1",
                row.length === 2 && "mx-auto max-w-xl grid-cols-2",
                row.length === 3 && "grid-cols-3",
                row.length >= 4 && "grid-cols-4"
              )}
            >
              {row.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * (rowIndex * 4 + i) }}
                >
                  <ModuleButton
                    node={m}
                    stats={stats}
                    active={activeModule === m.id}
                    onSelect={onSelect}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function chunkModules(modules: ModuleNode[], size: number): ModuleNode[][] {
  if (modules.length === 0) return [];
  const rows: ModuleNode[][] = [];
  for (let i = 0; i < modules.length; i += size) {
    rows.push(modules.slice(i, i + size));
  }
  return rows;
}

function Root({
  projectName,
  compact,
}: {
  projectName: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2 border-slate-300 bg-white text-center shadow-md shadow-slate-200/50",
        compact ? "max-w-none px-4 py-3" : "max-w-md px-8 py-4"
      )}
    >
      <p className="mb-0.5 text-[11px] font-semibold text-slate-500">פרויקט</p>
      <h2
        className={cn(
          "font-bold text-slate-900",
          compact ? "text-lg" : "text-2xl"
        )}
      >
        {projectName}
      </h2>
    </div>
  );
}

function Connector({ count }: { count: number }) {
  const pads = 12.5;
  const usable = 100 - pads * 2;
  const positions =
    count <= 1
      ? [50]
      : Array.from(
          { length: count },
          (_, i) => pads + (usable * i) / (count - 1)
        );

  return (
    <div className="relative mx-auto h-11 w-full">
      <div className="absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 bg-slate-300" />
      {count > 1 && (
        <div
          className="absolute top-3.5 h-px bg-slate-300"
          style={{
            left: `${positions[0]}%`,
            right: `${100 - positions[positions.length - 1]}%`,
          }}
        />
      )}
      {positions.map((p) => (
        <div
          key={p}
          className="absolute top-3.5 h-7 w-px bg-slate-300"
          style={{ left: `${p}%` }}
        />
      ))}
    </div>
  );
}

function ModuleButton({
  node,
  stats,
  active,
  onSelect,
  large,
}: {
  node: ModuleNode;
  stats?: ProjectNavTreeStats;
  active: boolean;
  onSelect: (id: ProjectModuleId) => void;
  large?: boolean;
}) {
  const Icon = node.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={cn(
        "group block w-full rounded-xl border-2 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        node.accent,
        large ? "min-h-[64px] p-4" : "p-3",
        active && "border-primary-400 ring-2 ring-primary-500 ring-offset-1"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg text-white",
            node.iconBg,
            large ? "h-11 w-11" : "h-9 w-9"
          )}
        >
          <Icon className={large ? "h-5 w-5" : "h-4 w-4"} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-bold text-slate-900",
              large ? "text-base" : "text-sm"
            )}
          >
            {node.title}
          </p>
          {node.lines(stats).map((line) => (
            <p key={line} className="mt-0.5 text-[11px] text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </div>
    </button>
  );
}
