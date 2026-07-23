"use client";

type Props = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  accent?: string;
  accentSoft?: string;
};

/** Widget slot for Portal dashboards (P1 mockups / P4 live) */
export function DashboardWidgetContainer({
  title,
  description,
  children,
  className = "",
  accent,
  accentSoft,
}: Props) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
      style={
        accent
          ? { borderTopWidth: 3, borderTopColor: accent }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          )}
        </div>
        {accentSoft && (
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
            style={{ background: accentSoft }}
          >
            Mock
          </span>
        )}
      </div>
      <div className="mt-4 min-h-[72px] text-sm text-gray-400">
        {children ?? "Widget placeholder"}
      </div>
    </section>
  );
}
