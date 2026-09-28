"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Modal, useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import { ProjectBoqPanel } from "@/features/projects/components/panels/project-boq-panel";
import { ProjectDeliveryNotesPanel } from "@/features/projects/components/panels/project-delivery-notes-panel";
import { ProjectWorkDiariesPanel } from "@/features/projects/components/panels/project-work-diaries-panel";
import { ProjectDashboardPanel } from "@/apps/system/project-dashboard-panel";
import { OriginalProjectFileCard } from "@/features/projects/components/original-project-file-card";
import {
  ADMIN_PROJECT_MODULE_IDS,
  ProjectModulesNavTree,
  type ProjectModuleId,
  type ProjectNavTreeStats,
} from "@/features/projects/components/project-modules-nav-tree";
import { cn } from "@/lib/utils";
import { fetchClientMe } from "@/lib/auth/client-me";
import {
  hasDocumentPermission,
  isSystemAdminRole,
} from "@/lib/auth/document-permissions";
import { OPERATIONS_MANAGER_ROLE } from "@/lib/auth/roles";
import { apiClient } from "@/lib/api/client";
import { ProjectManagerSelect } from "@/features/projects/components/project-manager-select";

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
  contractNumber?: string;
  contractor?: string;
  ownerId?: string | null;
  ownerName?: string | null;
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
  const [canDeleteProjects, setCanDeleteProjects] = useState(false);
  const [canFilterPm, setCanFilterPm] = useState(false);
  const [canCreateWorkDiary, setCanCreateWorkDiary] = useState(false);
  const [diaryCreateKey, setDiaryCreateKey] = useState(0);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<TreeProject | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);

  const effectiveOpsProjectId = opsProjectId || selectedId;

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => {
        const role = json.success ? json.data?.role : null;
        setCanDeleteProjects(Boolean(isSystemAdminRole(role)));
        setCanFilterPm(
          Boolean(isSystemAdminRole(role) || role === OPERATIONS_MANAGER_ROLE)
        );
        setCanCreateWorkDiary(hasDocumentPermission(role, "create"));
      })
      .catch(() => setCanDeleteProjects(false));
  }, []);

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
        const nextStats = {
          boqCount: tree.boqCount,
          sheetCount: tree.sheets?.length,
          invoiceCount: tree.invoices?.length,
          documentCount: tree.documents?.length,
          workDiaryCount: tree.workDiaries?.length ?? tree.workDiaryCount,
          deliveryCount: tree.deliveries?.length ?? tree.deliveryCount,
        };
        setTreeStats(nextStats);
        apiClient
          .get<{
            counts?: {
              total: number;
              completed: number;
              inProgress: number;
            };
          }>(`/api/work-diaries?projectId=${selectedId}&take=1`)
          .then((r) => {
            if (cancelled || !r.counts) return;
            setTreeStats((prev) => ({
              ...prev,
              ...nextStats,
              workDiaryCount: r.counts!.total,
              workDiaryCompleted: r.counts!.completed,
              workDiaryInProgress: r.counts!.inProgress,
            }));
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setTreeStats(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visibleProjects = useMemo(() => {
    if (!ownerFilter) return projects;
    if (ownerFilter === "unassigned") {
      return projects.filter((p) => !p.ownerId);
    }
    return projects.filter((p) => p.ownerId === ownerFilter);
  }, [projects, ownerFilter]);

  const selected = useMemo(
    () => visibleProjects.find((p) => p.id === selectedId) ?? null,
    [visibleProjects, selectedId]
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

  async function archiveProject() {
    if (!deleteProject || deleteConfirmName.trim() !== deleteProject.name) {
      return;
    }
    setDeletingProject(true);
    try {
      const response = await fetch(`/api/projects/${deleteProject.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() || undefined }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "מחיקת הפרויקט נכשלה");
      }

      const remaining = projects.filter((p) => p.id !== deleteProject.id);
      setProjects(remaining);
      setOpsProjects((items) =>
        items.filter((p) => p.id !== deleteProject.id)
      );
      if (selectedId === deleteProject.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteProject(null);
      setDeleteConfirmName("");
      setDeleteReason("");
      setProjectMenuId(null);
      toast.success("הפרויקט הועבר לארכיון");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "מחיקת הפרויקט נכשלה"
      );
    } finally {
      setDeletingProject(false);
    }
  }

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
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold md:hidden"
          onClick={() => setMobileProjectsOpen(true)}
        >
          פרויקטים
        </button>
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
          {basePath === "/system/accounts" && (
            <Link
              href="/projects/new"
              className="mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              פרויקט חדש
            </Link>
          )}
          {canFilterPm && projectScope === "all" && (
            <div className="mb-3 px-1">
              <p className="mb-1 text-[10px] font-semibold text-slate-400">
                סינון לפי מנהל פרויקט
              </p>
              <ProjectManagerSelect
                value={ownerFilter === "unassigned" ? "" : ownerFilter}
                onChange={(id) => setOwnerFilter(id)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
              />
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-slate-500 hover:underline"
                onClick={() =>
                  setOwnerFilter((current) =>
                    current === "unassigned" ? "" : "unassigned"
                  )
                }
              >
                {ownerFilter === "unassigned"
                  ? "הצג את כל הפרויקטים"
                  : "הצג ללא מנהל פרויקט"}
              </button>
            </div>
          )}
          <div className="max-h-[40vh] space-y-1 overflow-y-auto lg:max-h-[70vh]">
            {visibleProjects.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                אין פרויקטים
              </p>
            )}
            {visibleProjects.map((p) => (
              <div key={p.id} className="relative flex items-stretch">
                <button
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className={cn(
                    "min-w-0 flex-1 rounded-xl px-3 py-3 text-right text-sm transition active:scale-[0.99]",
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
                {canDeleteProjects && (
                  <button
                    type="button"
                    aria-label={`פעולות עבור ${p.name}`}
                    onClick={() =>
                      setProjectMenuId((current) =>
                        current === p.id ? null : p.id
                      )
                    }
                    className="my-2 rounded-lg px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
                {canDeleteProjects && projectMenuId === p.id && (
                  <div className="absolute left-1 top-10 z-20 min-w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteProject(p);
                        setDeleteConfirmName("");
                        setDeleteReason("");
                        setProjectMenuId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      מחיקת פרויקט
                    </button>
                  </div>
                )}
              </div>
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
                canCreateWorkDiary={canCreateWorkDiary}
                onCreateWorkDiary={() => {
                  selectModule("workDiaries");
                  setDiaryCreateKey((k) => k + 1);
                }}
              />
              <OriginalProjectFileCard projectId={selectedId} />

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
                    <ProjectWorkDiariesPanel
                      projectId={effectiveOpsProjectId}
                      projectName={selected.name}
                      openCreateKey={diaryCreateKey}
                      onCountsChange={(counts) =>
                        setTreeStats((prev) => ({
                          ...prev,
                          workDiaryCount: counts.total,
                          workDiaryCompleted: counts.completed,
                          workDiaryInProgress: counts.inProgress,
                        }))
                      }
                    />
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

      <Modal
        open={Boolean(deleteProject)}
        onClose={() => {
          if (deletingProject) return;
          setDeleteProject(null);
          setDeleteConfirmName("");
          setDeleteReason("");
        }}
        title="מחיקת פרויקט"
        description="מחיקת פרויקט היא פעולה קריטית. האם אתה בטוח?"
        size="sm"
      >
        {deleteProject && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="text-sm text-red-900">
                  <p className="font-black">{deleteProject.name}</p>
                  {deleteProject.contractNumber && (
                    <p className="mt-1 text-xs">
                      מספר פרויקט: {deleteProject.contractNumber}
                    </p>
                  )}
                  <p className="mt-2 leading-6">
                    הפרויקט יועבר לארכיון. דפי מדידה, כתבי כמויות, חשבונות,
                    תעודות, יומנים, מסמכים, נוכחות, שיוכים, קישורים והיסטוריה
                    יישמרו ולא יימחקו פיזית.
                  </p>
                </div>
              </div>
            </div>

            <label className="block text-sm">
              <span className="font-bold text-slate-800">
                סיבת המחיקה (אופציונלי)
              </span>
              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                rows={2}
                disabled={deletingProject}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="font-bold text-slate-800">
                לאישור, הקלד את שם הפרויקט:
              </span>
              <span className="mr-1 font-black">{deleteProject.name}</span>
              <input
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                disabled={deletingProject}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingProject}
                onClick={() => setDeleteProject(null)}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={
                  deletingProject ||
                  deleteConfirmName.trim() !== deleteProject.name
                }
                onClick={() => void archiveProject()}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingProject ? "מעביר לארכיון…" : "מחק פרויקט"}
              </button>
            </div>
          </div>
        )}
      </Modal>
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
