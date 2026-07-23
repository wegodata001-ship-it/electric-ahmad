"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckSquare,
  GitBranch,
  Link2,
  Bell,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { notificationService } from "@/features/notifications/services/notification.service";
import { FieldDashboardPage } from "@/features/field/components/field-dashboard-page";
import { OpsQueueHome } from "@/apps/operations/ops-queue-home";
import {
  DashboardWidgetContainer,
  ActionBarContainer,
} from "@/components/portal";
import { PORTALS, type PortalId } from "@/lib/portals/config";

type ProjectRow = { id: string; status?: string };

function useLiveCounts(portalId: PortalId) {
  const [counts, setCounts] = useState({
    projects: 0,
    notifications: 0,
    workflowPending: 0,
    approvalsPending: 0,
    shareLinks: 0,
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);

    const tasks: Promise<void>[] = [];

    if (portalId === "system" || portalId === "project") {
      tasks.push(
        apiClient
          .get<ProjectRow[]>("/api/projects")
          .then((rows) =>
            setCounts((c) => ({
              ...c,
              projects: rows.filter((p) => p.status === "active").length || rows.length,
            }))
          )
          .catch(() => undefined)
      );
    }

    tasks.push(
      notificationService
        .getUnread()
        .then((rows) => setCounts((c) => ({ ...c, notifications: rows.length })))
        .catch(() => undefined)
    );

    if (portalId === "system" || portalId === "operations" || portalId === "project") {
      tasks.push(
        apiClient
          .get<{ items: unknown[] }>("/api/workflow/pending")
          .then((data) =>
            setCounts((c) => ({ ...c, workflowPending: data.items.length }))
          )
          .catch(() => undefined)
      );
      tasks.push(
        apiClient
          .get<{ items: unknown[] }>("/api/approvals/pending")
          .then((data) =>
            setCounts((c) => ({ ...c, approvalsPending: data.items.length }))
          )
          .catch(() => undefined)
      );
    }

    if (portalId === "system" || portalId === "operations" || portalId === "project") {
      tasks.push(
        apiClient
          .get<{ items: unknown[] }>("/api/share-links")
          .then((data) =>
            setCounts((c) => ({ ...c, shareLinks: data.items.length }))
          )
          .catch(() => undefined)
      );
    }

    Promise.all(tasks).finally(() => setLoading(false));
  }, [portalId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { counts, loading, reload };
}

function PortalDashboardShell({
  portalId,
  children,
  onRefresh,
}: {
  portalId: PortalId;
  children: React.ReactNode;
  onRefresh?: () => void;
}) {
  const portal = PORTALS[portalId];
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
      </div>

      {onRefresh && (
        <ActionBarContainer
          actions={[
            {
              id: "refresh",
              label: "רענון נתונים",
              onClick: onRefresh,
            },
          ]}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export function SystemPortalDashboard() {
  const { counts, loading, reload } = useLiveCounts("system");
  const theme = PORTALS.system.theme;

  return (
    <PortalDashboardShell portalId="system" onRefresh={reload}>
      <DashboardWidgetContainer
        title="פרויקטים פעילים"
        description="מספר פרויקטים במערכת"
        accent={theme.accent}
      >
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.projects}
        </p>
        <Building2 className="mt-2 h-5 w-5 text-gray-300" />
      </DashboardWidgetContainer>

      <DashboardWidgetContainer
        title="התראות שלא נקראו"
        accent={theme.accent}
      >
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.notifications}
        </p>
        <Link
          href="/system/notifications"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Bell className="h-3.5 w-3.5" />
          מרכז התראות
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="Workflow ממתין" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.workflowPending}
        </p>
        <Link
          href="/system/workflow"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <GitBranch className="h-3.5 w-3.5" />
          מרכז Workflow
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="Share Links" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.shareLinks}
        </p>
        <Link
          href="/system/share-links"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Link2 className="h-3.5 w-3.5" />
          קישורים אחרונים
        </Link>
      </DashboardWidgetContainer>
    </PortalDashboardShell>
  );
}

export function ProjectPortalDashboard() {
  const { counts, loading, reload } = useLiveCounts("project");
  const theme = PORTALS.project.theme;

  return (
    <PortalDashboardShell portalId="project" onRefresh={reload}>
      <DashboardWidgetContainer
        title="פרויקטים"
        accent={theme.accent}
      >
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.projects}
        </p>
        <Link
          href="/project/projects"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Building2 className="h-3.5 w-3.5" />
          כל הפרויקטים
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="אישורים ממתינים" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.approvalsPending + counts.workflowPending}
        </p>
        <Link
          href="/project/approvals"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          מרכז אישורים
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="התראות" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.notifications}
        </p>
        <Link
          href="/project/notifications"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Bell className="h-3.5 w-3.5" />
          מרכז התראות
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="Share Links" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.shareLinks}
        </p>
        <Link
          href="/project/share-links"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Link2 className="h-3.5 w-3.5" />
          קישורים
        </Link>
      </DashboardWidgetContainer>
    </PortalDashboardShell>
  );
}

/** Legacy dashboard removed — Operations is button-first queue app. */
export function OperationsPortalDashboard() {
  return <OpsQueueHome />;
}

/** Field portal re-uses the live field dashboard module. */
export function FieldPortalDashboard() {
  return <FieldDashboardPage />;
}
