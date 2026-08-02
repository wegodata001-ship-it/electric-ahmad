"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Receipt,
  Table2,
  Truck,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import { ProjectBoqPanel } from "@/features/projects/components/panels/project-boq-panel";
import { ProjectDeliveryNotesPanel } from "@/features/projects/components/panels/project-delivery-notes-panel";
import { ProjectWorkDiariesPanel } from "@/features/projects/components/panels/project-work-diaries-panel";
import { ProjectDashboardPanel } from "@/apps/system/project-dashboard-panel";
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

export type AdminModuleId =
  | "summary"
  | "boq"
  | "performance"
  | "invoices"
  | "billing"
  | "deliveries"
  | "workDiaries"
  | "documents"
  | "reports";

type TreeProject = {
  id: string;
  name: string;
  contractor?: string;
};

type ModuleDef = {
  id: AdminModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MODULES: ModuleDef[] = [
  { id: "summary", label: "סיכום פרויקט", icon: LayoutDashboard },
  { id: "boq", label: "כתב כמויות", icon: ClipboardList },
  { id: "performance", label: "דפי מדידה", icon: Table2 },
  { id: "invoices", label: "חשבונות", icon: Receipt },
  { id: "billing", label: "חשבוניות", icon: FileSpreadsheet },
  { id: "deliveries", label: "תעודות משלוח", icon: Truck },
  { id: "workDiaries", label: "יומני עבודה", icon: BookOpen },
  { id: "documents", label: "מסמכים", icon: FolderOpen },
  { id: "reports", label: "דוחות", icon: BarChart3 },
];

const STORAGE_KEY = "admin-project-workspace-v1";
const BASE_PATH = "/system/accounts";

function PanelLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
      טוען מודול…
    </div>
  );
}

/**
 * מרכז השליטה של מנהל המערכת:
 * עץ פרויקטים קבוע בצד + תוכן דינמי במרכז (בלי מעבר עמוד).
 */
export function AdminProjectWorkspace() {
  const toast = useToast();
  const [projects, setProjects] = useState<TreeProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<AdminModuleId>("summary");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  // Restore tree state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        selectedId?: string;
        activeModule?: AdminModuleId;
        expanded?: Record<string, boolean>;
      };
      if (saved.selectedId) setSelectedId(saved.selectedId);
      if (saved.activeModule) setActiveModule(saved.activeModule);
      if (saved.expanded) setExpanded(saved.expanded);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist
  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selectedId, activeModule, expanded })
      );
    } catch {
      /* ignore */
    }
    const qs = new URLSearchParams({
      projectId: selectedId,
      module: activeModule,
    });
    window.history.replaceState(null, "", `${BASE_PATH}?${qs.toString()}`);
  }, [selectedId, activeModule, expanded]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoicesWorkspaceService
      .listProjects()
      .then((r) => {
        if (cancelled) return;
        const list = (r.projects ?? []) as TreeProject[];
        setProjects(list);
        setSelectedId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const fromUrl =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("projectId")
              : null;
          if (fromUrl && list.some((p) => p.id === fromUrl)) return fromUrl;
          return list[0]?.id ?? null;
        });
        setExpanded((prev) => {
          const next = { ...prev };
          for (const p of list) {
            if (next[p.id] === undefined) next[p.id] = true;
          }
          return next;
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
  }, []);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  const selectProject = useCallback((id: string) => {
    setSelectedId(id);
    setExpanded((e) => ({ ...e, [id]: true }));
    setActiveModule("summary");
    setMobileTreeOpen(false);
  }, []);

  const selectModule = useCallback((projectId: string, module: AdminModuleId) => {
    setSelectedId(projectId);
    setActiveModule(module);
    setExpanded((e) => ({ ...e, [projectId]: true }));
    setMobileTreeOpen(false);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-slate-500">
        טוען עץ פרויקטים…
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-3rem)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white"
      dir="rtl"
      data-admin-workspace="project-tree"
    >
      {/* Tree — desktop always; mobile drawer */}
      <aside
        className={cn(
          "z-20 flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50",
          "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:shadow-xl",
          mobileTreeOpen ? "max-md:flex" : "max-md:hidden",
          "md:relative md:flex"
        )}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900">עץ הפרויקט</h2>
              <p className="text-[11px] text-slate-500">
                {projects.length} פרויקטים · מרכז עבודה
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs md:hidden"
              onClick={() => setMobileTreeOpen(false)}
            >
              סגור
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {projects.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              אין פרויקטים
            </p>
          )}
          {projects.map((p) => {
            const isOpen = expanded[p.id] !== false;
            const isSelected = selectedId === p.id;
            return (
              <div key={p.id} className="rounded-xl">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                    aria-label={isOpen ? "כווץ" : "הרחב"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectProject(p.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg px-2 py-2 text-right transition-colors",
                      isSelected
                        ? "bg-slate-900 text-white"
                        : "text-slate-800 hover:bg-white"
                    )}
                  >
                    <p className="truncate text-sm font-bold">📁 {p.name}</p>
                    {p.contractor && (
                      <p
                        className={cn(
                          "truncate text-[10px]",
                          isSelected ? "text-slate-300" : "text-slate-500"
                        )}
                      >
                        {p.contractor}
                      </p>
                    )}
                  </button>
                </div>

                {isOpen && (
                  <div className="mr-5 mt-0.5 space-y-0.5 border-r border-slate-200 pr-2">
                    {MODULES.map((m) => {
                      const Icon = m.icon;
                      const active =
                        selectedId === p.id && activeModule === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectModule(p.id, m.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-[13px] transition-colors",
                            active
                              ? "bg-blue-600 font-semibold text-white"
                              : "text-slate-600 hover:bg-white hover:text-slate-900"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">
              {selected?.name ?? "בחרו פרויקט"}
            </p>
            <p className="text-[11px] text-slate-500">
              {MODULES.find((m) => m.id === activeModule)?.label ?? ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold md:hidden"
            onClick={() => setMobileTreeOpen(true)}
          >
            עץ פרויקטים
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!selectedId && (
            <p className="py-16 text-center text-sm text-slate-400">
              בחרו פרויקט מהעץ כדי להתחיל
            </p>
          )}

          {selectedId && activeModule === "summary" && (
            <ProjectDashboardPanel
              projectId={selectedId}
              onAddVariation={() => selectModule(selectedId, "boq")}
            />
          )}
          {selectedId && activeModule === "boq" && (
            <ProjectBoqPanel projectId={selectedId} />
          )}
          {selectedId && activeModule === "performance" && (
            <ProjectPerformancePage projectId={selectedId} embedded />
          )}
          {selectedId && activeModule === "invoices" && (
            <ProjectInvoicesPage projectId={selectedId} embedded />
          )}
          {selectedId && activeModule === "billing" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                חשבוניות — מסמכי חיוב מאושרים של הפרויקט
              </p>
              <ProjectInvoicesPage projectId={selectedId} embedded />
            </div>
          )}
          {selectedId && activeModule === "deliveries" && (
            <ProjectDeliveryNotesPanel projectId={selectedId} />
          )}
          {selectedId && activeModule === "workDiaries" && (
            <ProjectWorkDiariesPanel projectId={selectedId} />
          )}
          {selectedId && activeModule === "documents" && (
            <DocumentsHubV2Page projectId={selectedId} embedded />
          )}
          {selectedId && activeModule === "reports" && (
            <ProjectReportsPanel projectId={selectedId} />
          )}
        </main>
      </div>

      {mobileTreeOpen && (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          aria-label="סגור עץ"
          onClick={() => setMobileTreeOpen(false)}
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
