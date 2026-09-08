"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Building2,
  CheckSquare,
  ClipboardList,
  GitBranch,
  Link2,
  Package,
  Plus,
  Truck,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { notificationService } from "@/features/notifications/services/notification.service";
import { FieldDashboardPage } from "@/features/field/components/field-dashboard-page";
import {
  DashboardWidgetContainer,
  ActionBarContainer,
} from "@/components/portal";
import { PORTALS, type PortalId } from "@/lib/portals/config";

type ProjectRow = { id: string; status?: string };

type OpsQueue = {
  workOrdersToday: number;
  diariesPending: number;
  deliveryPending: number;
  diariesRevision: number;
  workOrdersDone: number;
};

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
              projects:
                rows.filter((p) => p.status === "active").length || rows.length,
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

    if (
      portalId === "system" ||
      portalId === "operations" ||
      portalId === "project"
    ) {
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

    if (portalId === "system" || portalId === "project") {
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
  extra,
}: {
  portalId: PortalId;
  children: React.ReactNode;
  onRefresh?: () => void;
  extra?: React.ReactNode;
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
      {extra}
    </div>
  );
}

export function SystemPortalDashboard() {
  const { counts, loading, reload } = useLiveCounts("system");
  const theme = PORTALS.system.theme;

  return (
    <PortalDashboardShell
      portalId="system"
      onRefresh={reload}
      extra={
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SysLink
            href="/system/accounts"
            title="חשבונות / עץ פרויקט"
            desc="מדידות · חשבונות · שליחה לאישור"
          />
          <SysLink
            href="/system/companies"
            title="פרויקטים / חברות"
            desc="ניהול פרויקטים וחברות"
          />
          <SysLink
            href="/system/users"
            title="משתמשים והרשאות"
            desc="מנהלי מערכת · תפעול · פרויקט · שטח"
          />
          <SysLink
            href="/system/workflow"
            title="Workflow"
            desc="תור אישורים ומעברי סטטוס"
          />
          <SysLink
            href="/system/documents"
            title="מסמכים"
            desc="ארכיון מסמכים ארגוני"
          />
          <SysLink
            href="/system/documents?tab=shares"
            title="Share Links"
            desc="קישורי לקוח וחתימה"
          />
        </div>
      }
    >
      <DashboardWidgetContainer
        title="פרויקטים פעילים"
        description="מספר פרויקטים במערכת"
        accent={theme.accent}
      >
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.projects}
        </p>
        <Link
          href="/system/companies"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Building2 className="h-3.5 w-3.5" />
          פרויקטים / חברות
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="התראות שלא נקראו" accent={theme.accent}>
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
          href="/system/documents?tab=shares"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Link2 className="h-3.5 w-3.5" />
          קישורים אחרונים
        </Link>
      </DashboardWidgetContainer>
    </PortalDashboardShell>
  );
}

function SysLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-400"
    >
      <p className="font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </Link>
  );
}

export function ProjectPortalDashboard() {
  const { counts, loading, reload } = useLiveCounts("project");
  const theme = PORTALS.project.theme;

  return (
    <PortalDashboardShell portalId="project" onRefresh={reload}>
      <DashboardWidgetContainer title="פרויקטים" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.projects}
        </p>
        <Link
          href="/project/accounts"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Building2 className="h-3.5 w-3.5" />
          עץ פרויקט / חשבונות
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
          href="/project/documents?tab=shares"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Link2 className="h-3.5 w-3.5" />
          קישורים
        </Link>
      </DashboardWidgetContainer>
    </PortalDashboardShell>
  );
}

/** Operations — focused ops control center (not empty buttons, not full ERP) */
export function OperationsPortalDashboard() {
  const { counts, loading, reload } = useLiveCounts("operations");
  const theme = PORTALS.operations.theme;
  const [queue, setQueue] = useState<OpsQueue | null>(null);

  const reloadAll = useCallback(() => {
    reload();
    apiClient
      .get<{ queue: OpsQueue }>("/api/work-orders")
      .then((d) => setQueue(d.queue))
      .catch(() => undefined);
  }, [reload]);

  useEffect(() => {
    apiClient
      .get<{ queue: OpsQueue }>("/api/work-orders")
      .then((d) => setQueue(d.queue))
      .catch(() => undefined);
  }, []);

  return (
    <PortalDashboardShell
      portalId="operations"
      onRefresh={reloadAll}
      extra={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpsAction
            href="/operations/work-orders/new"
            icon={Plus}
            title="יצירת סידור עבודה"
            subtitle="פרויקט · מנהל עבודה · עובדים · שלח"
            primary
          />
          <OpsAction
            href="/operations/approvals"
            icon={CheckSquare}
            title="מרכז אישורים"
            subtitle="אשר / החזר לתיקון"
            badge={counts.approvalsPending}
          />
          <OpsAction
            href="/operations/work-diaries"
            icon={BookOpen}
            title="יומני עבודה"
            subtitle="דיווחים מהשטח"
            badge={queue?.diariesPending}
          />
          <OpsAction
            href="/operations/delivery-notes"
            icon={Package}
            title="תעודות משלוח"
            subtitle="ציוד וכמויות"
            badge={queue?.deliveryPending}
          />
          <OpsAction
            href="/operations/work-orders"
            icon={ClipboardList}
            title="סידורי עבודה"
            subtitle={`היום ${queue?.workOrdersToday ?? "—"} · הסתיימו ${queue?.workOrdersDone ?? "—"}`}
          />
          <OpsAction
            href="/operations/reports"
            icon={Truck}
            title="דוחות ביצוע"
            subtitle="מעקב סטטוס וחריגות"
            badge={queue?.diariesRevision}
          />
        </div>
      }
    >
      <DashboardWidgetContainer title="ממתינים לאישור" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.approvalsPending}
        </p>
        <Link
          href="/operations/approvals"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          מרכז אישורים
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="סידורים להיום" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {queue ? queue.workOrdersToday : "…"}
        </p>
        <Link
          href="/operations/work-orders"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          כל הסידורים
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="הוחזרו לתיקון" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {queue ? queue.diariesRevision : "…"}
        </p>
        <Link
          href="/operations/work-diaries"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <BookOpen className="h-3.5 w-3.5" />
          יומנים
        </Link>
      </DashboardWidgetContainer>

      <DashboardWidgetContainer title="התראות" accent={theme.accent}>
        <p className="text-3xl font-bold" style={{ color: theme.accent }}>
          {loading ? "…" : counts.notifications}
        </p>
        <Link
          href="/operations/notifications"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          <Bell className="h-3.5 w-3.5" />
          התראות
        </Link>
      </DashboardWidgetContainer>
    </PortalDashboardShell>
  );
}

function OpsAction({
  href,
  icon: Icon,
  title,
  subtitle,
  primary,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  primary?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex min-h-[4.75rem] items-center gap-3 rounded-2xl bg-[var(--portal-accent,#b45309)] px-4 text-white shadow-sm"
          : "flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4"
      }
    >
      <Icon className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className={`text-xs ${primary ? "text-amber-100" : "text-gray-500"}`}>
          {subtitle}
        </p>
      </div>
      {typeof badge === "number" && badge > 0 && (
        <span
          className={
            primary
              ? "rounded-full bg-white px-2.5 py-1 text-xs font-black text-amber-800"
              : "rounded-full bg-amber-700 px-2.5 py-1 text-xs font-black text-white"
          }
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

/** Field portal — mobile app shell owns home; legacy fallback only */
export function FieldPortalDashboard() {
  return <FieldDashboardPage />;
}
