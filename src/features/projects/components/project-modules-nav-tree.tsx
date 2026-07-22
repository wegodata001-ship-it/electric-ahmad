"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  FileText,
  Package,
  Receipt,
  Table2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectModuleId =
  | "boq"
  | "performance"
  | "invoices"
  | "documents"
  | "workDiaries"
  | "deliveries";

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
  lines: string[];
};

type Props = {
  projectName: string;
  activeModule: ProjectModuleId | null;
  onSelect: (id: ProjectModuleId) => void;
  stats?: ProjectNavTreeStats;
};

export function ProjectModulesNavTree({
  projectName,
  activeModule,
  onSelect,
  stats,
}: Props) {
  const modules: ModuleNode[] = [
    {
      id: "boq",
      title: "כתב כמויות",
      icon: ClipboardList,
      accent:
        "border-sky-300 bg-gradient-to-b from-sky-50 to-white hover:border-sky-500",
      iconBg: "bg-sky-600",
      lines: [`${stats?.boqCount ?? 0} סעיפים`],
    },
    {
      id: "performance",
      title: "דפי מדידה",
      icon: Table2,
      accent:
        "border-violet-300 bg-gradient-to-b from-violet-50 to-white hover:border-violet-500",
      iconBg: "bg-violet-600",
      lines: [`${stats?.sheetCount ?? 0} דפי מדידה`],
    },
    {
      id: "invoices",
      title: "חשבונות",
      icon: Receipt,
      accent:
        "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white hover:border-emerald-500",
      iconBg: "bg-emerald-600",
      lines: [`${stats?.invoiceCount ?? 0} חשבונות`],
    },
    {
      id: "documents",
      title: "מסמכים",
      icon: FileText,
      accent:
        "border-amber-300 bg-gradient-to-b from-amber-50 to-white hover:border-amber-500",
      iconBg: "bg-amber-600",
      lines: [`${stats?.documentCount ?? 0} קבצים`],
    },
    {
      id: "workDiaries",
      title: "יומן עבודה",
      icon: Package,
      accent:
        "border-indigo-300 bg-gradient-to-b from-indigo-50 to-white hover:border-indigo-500",
      iconBg: "bg-indigo-600",
      lines: [`${stats?.workDiaryCount ?? 0} ימי עבודה`],
    },
    {
      id: "deliveries",
      title: "תעודות משלוח",
      icon: Truck,
      accent:
        "border-orange-300 bg-gradient-to-b from-orange-50 to-white hover:border-orange-500",
      iconBg: "bg-orange-600",
      lines: [`${stats?.deliveryCount ?? 0} תעודות`],
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#f1f5f9_100%)] p-3 sm:p-5">
      {/* Mobile: stacked large tap targets */}
      <div className="space-y-2 md:hidden">
        <Root projectName={projectName} compact />
        <div className="mx-auto h-4 w-px bg-slate-300" />
        <div className="grid grid-cols-1 gap-2">
          {modules.map((m) => (
            <ModuleButton
              key={m.id}
              node={m}
              active={activeModule === m.id}
              onSelect={onSelect}
              large
            />
          ))}
        </div>
      </div>

      {/* Desktop: ownership tree */}
      <div className="hidden md:block">
        <div className="flex justify-center">
          <Root projectName={projectName} />
        </div>
        <Connector positions={[12.5, 37.5, 62.5, 87.5]} />
        <div className="grid grid-cols-4 gap-3 px-1">
          {modules.slice(0, 4).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
            >
              <ModuleButton
                node={m}
                active={activeModule === m.id}
                onSelect={onSelect}
              />
            </motion.div>
          ))}
        </div>
        <div className="mt-5 flex justify-center gap-3">
          {modules.slice(4).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + 0.04 * i }}
              className="w-full max-w-[200px]"
            >
              <div className="mx-auto flex justify-center">
                <div className="h-4 w-px bg-slate-300" />
              </div>
              <ModuleButton
                node={m}
                active={activeModule === m.id}
                onSelect={onSelect}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
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

function Connector({ positions }: { positions: number[] }) {
  return (
    <div className="relative mx-auto h-11 w-full">
      <div className="absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 bg-slate-300" />
      <div
        className="absolute top-3.5 h-px bg-slate-300"
        style={{
          left: `${positions[0]}%`,
          right: `${100 - positions[positions.length - 1]}%`,
        }}
      />
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
  active,
  onSelect,
  large,
}: {
  node: ModuleNode;
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
        large ? "p-4 min-h-[64px]" : "p-3",
        active && "ring-2 ring-offset-1 ring-primary-500 border-primary-400"
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
          <p className={cn("font-bold text-slate-900", large ? "text-base" : "text-sm")}>
            {node.title}
          </p>
          {node.lines.map((line) => (
            <p key={line} className="mt-0.5 text-[11px] text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </div>
    </button>
  );
}