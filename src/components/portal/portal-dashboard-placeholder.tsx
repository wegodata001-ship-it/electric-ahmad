"use client";

import { ActionBarContainer } from "@/components/portal/action-bar-container";
import { DashboardWidgetContainer } from "@/components/portal/dashboard-widget-container";
import {
  PORTALS,
  PORTAL_DASHBOARD_MOCKS,
  type PortalId,
} from "@/lib/portals/config";

/** P1 UX mockup — visual only, no live KPIs / charts */
export function PortalDashboardPlaceholder({
  portalId,
}: {
  portalId: PortalId;
}) {
  const portal = PORTALS[portalId];
  const widgets = PORTAL_DASHBOARD_MOCKS[portalId] ?? [];
  const { theme } = portal;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: theme.accentMuted }}
          >
            {portal.shortName}
          </p>
          <h1 className="mt-0.5 text-xl font-bold text-gray-900 sm:text-2xl">
            {portal.headerTitle}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{portal.description}</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            background: theme.accentSoft,
            color: theme.accentMuted,
          }}
        >
          Mockup · P1 Review
        </span>
      </div>

      <ActionBarContainer>
        <span className="text-xs text-gray-500">
          פעולות מהירות יופיעו בשלבים הבאים · כרגע שלד בלבד
        </span>
      </ActionBarContainer>

      <div
        className={
          widgets.length === 3
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        {widgets.map((w) => {
          const Icon = w.icon;
          return (
            <DashboardWidgetContainer
              key={w.id}
              title={w.title}
              description={w.subtitle}
              accent={theme.accent}
              accentSoft={theme.accentSoft}
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p
                    className="text-2xl font-bold tracking-tight sm:text-3xl"
                    style={{ color: theme.accent }}
                  >
                    {w.value}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">{w.hint}</p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: theme.accentSoft, color: theme.accent }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </DashboardWidgetContainer>
          );
        })}
      </div>
    </div>
  );
}
