"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "../services/invoices-workspace.service";
import {
  ProjectModulesNavTree,
  type ProjectModuleId,
} from "@/features/projects/components/project-modules-nav-tree";
import { ProjectBoqPanel } from "@/features/projects/components/panels/project-boq-panel";
import { ProjectInvoicesPage } from "@/features/projects/components/project-invoices-page";
import { ProjectPerformancePage } from "@/features/projects/components/project-performance-page";
import { ProjectDocumentsHubPage } from "@/features/projects/components/project-documents-hub-page";
import { ProjectDeliveryNotesPanel } from "@/features/projects/components/panels/project-delivery-notes-panel";
import { ProjectWorkDiariesPanel } from "@/features/projects/components/panels/project-work-diaries-panel";
import { cn } from "@/lib/utils";

/**
 * מסך אחד: רשימת פרויקטים + עץ קבוע + אזור תוכן דינמי.
 * לחיצה על מודול מחליפה רק את התוכן — בלי ניווט לעמוד אחר.
 */
export function InvoicesWorkspacePage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const projectFromQuery = searchParams.get("projectId");
  const moduleFromQuery = searchParams.get("module") as ProjectModuleId | null;
  const safeModule =
    moduleFromQuery === ("gallery" as ProjectModuleId)
      ? ("documents" as ProjectModuleId)
      : moduleFromQuery;

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(projectFromQuery);
  const [tree, setTree] = useState<any>(null);
  const [activeModule, setActiveModule] = useState<ProjectModuleId | null>(
    safeModule
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoicesWorkspaceService
      .listProjects()
      .then((r) => {
        setProjects(r.projects);
        if (!selectedId && r.projects[0]) setSelectedId(r.projects[0].id);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setTree(null);
    setActiveModule((prev) => {
      // Keep module from URL only on first paint for this project
      if (projectFromQuery === selectedId && safeModule) return safeModule;
      return null;
    });
    const qs = new URLSearchParams({ projectId: selectedId });
    window.history.replaceState(null, "", `/invoices?${qs.toString()}`);
    invoicesWorkspaceService
      .getTree(selectedId)
      .then(setTree)
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function selectModule(id: ProjectModuleId) {
    setActiveModule(id);
    if (selectedId) {
      window.history.replaceState(
        null,
        "",
        `/invoices?projectId=${selectedId}&module=${id}`
      );
    }
    // Soft scroll content into view on mobile
    requestAnimationFrame(() => {
      document
        .getElementById("project-module-content")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">טוען…</p>;
  }

  return (
    <div className="space-y-4 pb-8 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">חשבונות</h1>
        <p className="mt-1 text-sm text-gray-500">
          בחרו פרויקט ומודול בעץ — העבודה נשארת באותו מסך
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr] lg:gap-6">
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-3 lg:sticky lg:top-4">
          <p className="mb-2 px-2 text-xs font-semibold text-gray-400">
            פרויקטים
          </p>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto lg:max-h-[70vh]">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-right text-sm transition active:scale-[0.99]",
                  selectedId === p.id
                    ? "bg-primary-50 font-semibold text-primary-800"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <span className="block truncate">{p.name}</span>
                <span className="block truncate text-xs text-gray-400">
                  {p.contractor}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {!selectedId && (
            <p className="text-sm text-gray-500">בחרו פרויקט מהרשימה</p>
          )}
          {selectedId && !tree && (
            <p className="text-sm text-gray-500">טוען פרויקט…</p>
          )}

          {tree && (
            <>
              <ProjectModulesNavTree
                projectName={tree.project.name}
                activeModule={activeModule}
                onSelect={selectModule}
                stats={{
                  boqCount: tree.boqCount,
                  sheetCount: tree.sheets?.length,
                  invoiceCount: tree.invoices?.length,
                  documentCount: tree.documents?.length,
                }}
              />

              <div
                id="project-module-content"
                className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-5"
              >
                {!activeModule && (
                  <p className="py-10 text-center text-sm text-gray-500">
                    בחרו מודול מתוך העץ כדי להתחיל לעבוד
                  </p>
                )}

                {activeModule === "boq" && (
                  <ProjectBoqPanel projectId={tree.project.id} />
                )}
                {activeModule === "performance" && (
                  <ProjectPerformancePage
                    projectId={tree.project.id}
                    embedded
                  />
                )}
                {activeModule === "invoices" && (
                  <ProjectInvoicesPage projectId={tree.project.id} embedded />
                )}
                {activeModule === "documents" && (
                  <ProjectDocumentsHubPage
                    projectId={tree.project.id}
                    embedded
                  />
                )}
                {activeModule === "workDiaries" && (
                  <ProjectWorkDiariesPanel projectId={tree.project.id} />
                )}
                {activeModule === "deliveries" && (
                  <ProjectDeliveryNotesPanel projectId={tree.project.id} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
