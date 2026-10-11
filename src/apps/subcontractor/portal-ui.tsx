"use client";

import { cn } from "@/lib/utils";

export function PortalPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111111]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#5B6470]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function PortalCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E6E8EB] bg-white p-4 shadow-[0_4px_14px_rgba(17,17,17,0.04)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  const bar =
    tone === "brand"
      ? "bg-[#C8102E]"
      : tone === "success"
        ? "bg-emerald-600"
        : tone === "warning"
          ? "bg-amber-500"
          : "bg-slate-300";
  return (
    <PortalCard className="relative overflow-hidden">
      <span className={cn("absolute inset-y-0 right-0 w-1", bar)} />
      <p className="text-xs font-semibold text-[#5B6470]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#111111]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[#5B6470]">{hint}</p>}
    </PortalCard>
  );
}

export function FilterRow({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "min-h-10 rounded-full px-3 text-xs font-bold",
            value === opt.id ? "bg-[#C8102E] text-white" : "bg-white text-[#5B6470] ring-1 ring-[#E6E8EB]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <PortalCard className="py-10 text-center">
      <p className="font-black text-[#111111]">{title}</p>
      {text && <p className="mt-1 text-sm text-[#5B6470]">{text}</p>}
    </PortalCard>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <PortalCard className="border-red-100 bg-red-50">
      <p className="text-sm font-bold text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="mt-3 min-h-11 rounded-xl bg-white px-4 text-sm font-bold"
          onClick={onRetry}
        >
          נסה שוב
        </button>
      )}
    </PortalCard>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export function moneyText(value: number) {
  return `${value.toLocaleString("he-IL")} ₪`;
}

export function StatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        className
      )}
    >
      {label}
    </span>
  );
}

export const DIARY_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  assigned: "הוקצה",
  in_progress: "בביצוע",
  pending_approval: "ממתין לאישור",
  in_approval: "בבדיקה",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  signed: "נחתם",
  returned: "הוחזר לתיקון",
  rejected: "נדחה",
};

export const MEASUREMENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  in_review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  returned: "bg-red-100 text-red-800",
  partial: "bg-violet-100 text-violet-800",
};

export const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  pm_review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  ready_for_payment: "bg-emerald-100 text-emerald-800",
  paid: "bg-slate-900 text-white",
  returned: "bg-red-100 text-red-800",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer: "העברה בנקאית",
  check: "שיק",
  cash: "מזומן",
  other: "אחר",
};

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}
