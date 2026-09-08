"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import { ProjectBoqPanel } from "@/features/projects/components/panels/project-boq-panel";
import { ProjectDeliveryNotesPanel } from "@/features/projects/components/panels/project-delivery-notes-panel";
import { ProjectWorkDiariesPanel } from "@/features/projects/components/panels/project-work-diaries-panel";
import { ProjectDashboardPanel } from "@/apps/system/project-dashboard-panel";
import {
  ADMIN_PROJECT_MODULE_IDS,
  ProjectModulesNavTree,
  type ProjectModuleId,
  type ProjectNavTreeStats,
} from "@/features/projects/components/project-modules-nav-tree";
import { cn } from "@/lib/utils";

const ProjectInvoicesPage = dynamic(
  () =>
    import("@/features/projects/components/project-invoices-page").then(
      (m) => m.ProjectInvoicesPage
    ),
  { ssr: false, loading: () => <PanelLoading /> }
);

const ProjectPerformancePage = dynamic(
  () =>
    import("@/features/projects/components/project-performance-page").then(
      (m) => m.ProjectPerformancePage
    ),
  { ssr: false, loading: () => <PanelLoading /> }
);

const DocumentsHubV2Page = dynamic(
  () =>
    import("@/features/documents/components/documents-hub-v2-page").then(
      (m) => m.DocumentsHubV2Page
    ),
  { ssr: false, loading: () => <PanelLoading /> }
);

export type AdminModuleId = ProjectModuleId;

type TreeProject = {
  id: string;
  name: string;
  contractor?: string;
};

function PanelLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
      טוען מודול…
    </div>
  );
}

type WorkspaceProps = {
  /** Portal route for URL sync, e.g. /system/accounts or /operations/accounts */
  basePath?: string;
  storageKey?: string;
  /**
   * assigned = עץ רק פרויקטים שהוקצו (Project Manager).
   * all = כל הפרויקטים (System / Ops).
   */
  projectScope?: "assigned" | "all";
};

/**
 * עץ פרויקט משותף — System / Operations / Project Manager.
 * רשימת פרויקטים + גרף מודולים ויזואלי + תוכן מודול.
 * הבדלים בין תפקידים נאכפים בהרשאות (FE+BE), לא בשכפול UI.
 */
export function AdminProjectWorkspace({
  basePath = "/system/accounts",
  storageKey = "admin-project-workspace-v1",
  projectScope = "all",
}: WorkspaceProps = {}) {
  const toast = useToast();
  const [projects, setProjects] = useState<TreeProject[]>([]);
  const [opsProjects, setOpsProjects] = useState<TreeProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opsProjectId, setOpsProjectId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<AdminModuleId>("summary");
  const [loading, setLoading] = useState(true);
  const [mobileProjectsOpen, setMobileProjectsOpen] = useState(false);
  const [treeStats, setTreeStats] = useState<ProjectNavTreeStats | undefined>();

  const effectiveOpsProjectId = opsProjectId || selectedId;

  // Restore workspace state — URL wins over localStorage (deep links from «תיקונים»)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlProject = params.get("projectId");
      const urlModule = params.get("module") as AdminModuleId | null;
      if (urlProject) setSelectedId(urlProject);
      if (urlModule && ADMIN_PROJECT_MODULE_IDS.includes(urlModule)) {
        setActiveModule(urlModule);
      }
      if (urlProject || urlModule) return;

      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        selectedId?: string;
        activeModule?: AdminModuleId;
      };
      if (saved.selectedId) setSelectedId(saved.selectedId);
      if (saved.activeModule) setActiveModule(saved.activeModule);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Persist + URL sync (preserve sheetId for performance deep-link)
  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ selectedId, activeModule })
      );
    } catch {
      /* ignore */
    }
    const qs = new URLSearchParams({
      projectId: selectedId,
      module: activeModule,
    });
    const sheetId = new URLSearchParams(window.location.search).get("sheetId");
    if (sheetId) qs.set("sheetId", sheetId);
    const pmEdit = new URLSearchParams(window.location.search).get("pmEdit");
    if (pmEdit) qs.set("pmEdit", pmEdit);
    window.history.replaceState(null, "", `${basePath}?${qs.toString()}`);
  }, [selectedId, activeModule, basePath, storageKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      invoicesWorkspaceService.listProjects().catch(() => ({ projects: [] })),
      projectScope === "assigned"
        ? fetch("/api/invoices/workspace?scope=operational")
            .then((r) => r.json())
            .then((j) => (j.data?.projects ?? j.projects ?? []) as TreeProject[])
            .catch(() => [] as TreeProject[])
        : Promise.resolve([] as TreeProject[]),
    ])
      .then(([r, allOps]) => {
        if (cancelled) return;
        const list = (r.projects ?? []) as TreeProject[];
        setProjects(list);
        setOpsProjects(allOps.length ? allOps : list);
        setSelectedId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const fromUrl =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("projectId")
              : null;
          if (fromUrl && list.some((p) => p.id === fromUrl)) return fromUrl;
          return list[0]?.id ?? null;
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectScope]);

  useEffect(() => {
    if (!selectedId) return;
    if (!opsProjectId) setOpsProjectId(selectedId);
  }, [selectedId, opsProjectId]);

  // Optional stats for graph node labels (same API as invoices workspace)
  useEffect(() => {
    if (!selectedId) {
      setTreeStats(undefined);
      return;
    }
    let cancelled = false;
    invoicesWorkspaceService
      .getTree(selectedId)
      .then((tree) => {
        if (cancelled) return;
        setTreeStats({
          boqCount: tree.boqCount,
          sheetCount: tree.sheets?.length,
          invoiceCount: tree.invoices?.length,
          documentCount: tree.documents?.length,
          workDiaryCount: tree.workDiaries?.length ?? tree.workDiaryCount,
          deliveryCount: tree.deliveries?.length ?? tree.deliveryCount,
        });
      })
      .catch(() => {
        if (!cancelled) setTreeStats(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  const selectProject = useCallback((id: string) => {
    setSelectedId(id);
    setActiveModule("summary");
    setMobileProjectsOpen(false);
  }, []);

  const selectModule = useCallback((module: AdminModuleId) => {
    setActiveModule(module);
    setMobileProjectsOpen(false);
    requestAnimationFrame(() => {
      document
        .getElementById("project-module-content")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-slate-500">
        טוען עץ פרויקטים…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8 sm:space-y-6" dir="rtl" data-admin-workspace="project-tree">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">עץ פרויקט</h1>
          <p className="mt-1 text-sm text-slate-500">
            בחרו פרויקט ומודול מהגרף — העבודה נשארת באותו מסך
          </p>
        </div>
        <div className="flex items-center gap-2">
          {basePath === "/system/accounts" && (
            <Link
              href="/projects/new"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              פרויקט חדש
            </Link>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold md:hidden"
            onClick={() => setMobileProjectsOpen(true)}
          >
            פרויקטים
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr] lg:gap-6">
        {/* Project list only — modules live in the graph */}
        <aside
          className={cn(
            "h-fit rounded-2xl border border-slate-200 bg-white p-3",
            "lg:sticky lg:top-4",
            "max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:w-72 max-md:overflow-y-auto max-md:shadow-xl",
            mobileProjectsOpen ? "max-md:block" : "max-md:hidden",
            "md:block"
          )}
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-semibold text-slate-400">פרויקטים</p>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs md:hidden"
              onClick={() => setMobileProjectsOpen(false)}
            >
              סגור
            </button>
          </div>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto lg:max-h-[70vh]">
            {projects.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                אין פרויקטים
              </p>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProject(p.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-right text-sm transition active:scale-[0.99]",
                  selectedId === p.id
                    ? "bg-primary-50 font-semibold text-primary-800"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="block truncate">{p.name}</span>
                {p.contractor && (
                  <span className="block truncate text-xs text-slate-400">
                    {p.contractor}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {!selectedId && (
            <p className="py-16 text-center text-sm text-slate-400">
              בחרו פרויקט מהרשימה כדי להתחיל
            </p>
          )}

          {selectedId && selected && (
            <>
              <ProjectModulesNavTree
                projectName={selected.name}
                activeModule={activeModule}
                onSelect={selectModule}
                stats={treeStats}
                moduleIds={ADMIN_PROJECT_MODULE_IDS}
              />

              <div
                id="project-module-content"
                className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5"
              >
                {activeModule === "summary" && (
                  <ProjectDashboardPanel
                    projectId={selectedId}
                    onAddVariation={() => selectModule("boq")}
                  />
                )}
                {activeModule === "boq" && (
                  <ProjectBoqPanel projectId={selectedId} />
                )}
                {activeModule === "performance" && (
                  <ProjectPerformancePage projectId={selectedId} embedded />
                )}
                {activeModule === "invoices" && (
                  <ProjectInvoicesPage projectId={selectedId} embedded />
                )}
                {activeModule === "billing" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      חשבוניות — מסמכי חיוב מאושרים של הפרויקט
                    </p>
                    <ProjectInvoicesPage projectId={selectedId} embedded />
                  </div>
                )}
                {activeModule === "deliveries" && effectiveOpsProjectId && (
                  <div className="space-y-3">
                    {projectScope === "assigned" && (
                      <OpsProjectPicker
                        projects={opsProjects}
                        value={effectiveOpsProjectId}
                        onChange={setOpsProjectId}
                        label="תעודות משלוח — ניתן לבחור כל פרויקט במערכת"
                      />
                    )}
                    <ProjectDeliveryNotesPanel projectId={effectiveOpsProjectId} />
                  </div>
                )}
                {activeModule === "workDiaries" && effectiveOpsProjectId && (
                  <div className="space-y-3">
                    {projectScope === "assigned" && (
                      <OpsProjectPicker
                        projects={opsProjects}
                        value={effectiveOpsProjectId}
                        onChange={setOpsProjectId}
                        label="יומני עבודה — ניתן לבחור כל פרויקט במערכת"
                      />
                    )}
                    <ProjectWorkDiariesPanel projectId={effectiveOpsProjectId} />
                  </div>
                )}
                {activeModule === "documents" && (
                  <DocumentsHubV2Page projectId={selectedId} embedded />
                )}
                {activeModule === "reports" && (
                  <ProjectReportsPanel projectId={selectedId} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {mobileProjectsOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          aria-label="סגור רשימת פרויקטים"
          onClick={() => setMobileProjectsOpen(false)}
        />
      )}
    </div>
  );
}

function ProjectReportsPanel({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">דוחות</h2>
        <p className="text-sm text-slate-500">
          סיכומי ביצוע ותקציב — מבוסס על נתוני הפרויקט
        </p>
      </div>
      <ProjectDashboardPanel projectId={projectId} />
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <FileText className="h-3.5 w-3.5" />
        דוחות מורחבים לייצוא יתווספו בהמשך — הנתונים כאן הם תמונת מצב חיה.
      </p>
    </div>
  );
}

function OpsProjectPicker({
  projects,
  value,
  onChange,
  label,
}: {
  projects: TreeProject[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
      <p className="mb-1.5 text-[11px] font-semibold text-amber-900">{label}</p>
      <select
        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
