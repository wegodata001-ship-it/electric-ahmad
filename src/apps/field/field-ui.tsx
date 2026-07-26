import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Field Portal light theme tokens (construction / outdoor readability) */
export const field = {
  page: "bg-[#F7F8FA] text-[#111827]",
  card: "rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm",
  cardInteractive:
    "rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm active:bg-gray-50",
  muted: "text-[#6B7280]",
  title: "text-[26px] font-black leading-tight tracking-tight text-[#111827]",
  subtitle: "mt-1 text-lg text-[#6B7280]",
  body: "text-base text-[#111827]",
  input:
    "w-full min-h-14 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-lg text-[#111827] placeholder:text-[#9CA3AF] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
  btnPrimary:
    "flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-lg font-black text-white disabled:opacity-60",
  btnSuccess:
    "flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 text-lg font-black text-white disabled:opacity-60",
  btnDanger:
    "flex min-h-14 w-full items-center justify-center rounded-2xl bg-red-600 px-4 text-lg font-black text-white disabled:opacity-60",
  btnGhost:
    "flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 text-lg font-bold text-[#111827] disabled:opacity-60",
  error: "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700",
  badge: {
    green: "rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800",
    yellow: "rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800",
    red: "rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-800",
    orange: "rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-800",
    gray: "rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700",
    blue: "rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800",
  },
} as const;

export function FieldEmptyState({
  emoji,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  emoji: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={cn(field.card, "px-6 py-10 text-center")}>
      <p className="text-5xl" aria-hidden>
        {emoji}
      </p>
      <h2 className="mt-4 text-xl font-black text-[#111827]">{title}</h2>
      {description && (
        <p className="mx-auto mt-2 max-w-xs text-base leading-relaxed text-[#6B7280]">
          {description}
        </p>
      )}
      {actionHref && actionLabel && (
        <Link href={actionHref} className={cn(field.btnPrimary, "mt-6")}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function FieldPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className={field.title}>{title}</h1>
        {subtitle && <p className={field.subtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
