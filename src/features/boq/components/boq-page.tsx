"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { boqService } from "@/features/boq/services/boq.service";
import { projectService } from "@/services";
import type { BoqItem, Project } from "@/types";
import { BoqTable } from "./boq-table";
import { BoqItemFormModal } from "./boq-item-form-modal";
import { Button, Card, useToast } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { Plus } from "lucide-react";

const PAGE_SIZE = 50;

type KindFilter = "all" | "regular" | "exceptional";

export function BoqPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const projectFromQuery = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    projectFromQuery || "all"
  );
  const [showExceptionalModal, setShowExceptionalModal] = useState(false);

  // Legacy — all-projects view still loads everything for aggregate stats.
  const [allItems, setAllItems] = useState<BoqItem[]>([]);

  // Server-paged view — used when a project is selected.
  const [pagedItems, setPagedItems] = useState<BoqItem[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [globalFilter, setGlobalFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [pageLoading, setPageLoading] = useState(false);
  const requestSeq = useRef(0);

  const useServer = selectedProject !== "all";

  useEffect(() => {
    if (projectFromQuery) setSelectedProject(projectFromQuery);
  }, [projectFromQuery]);

  const reloadAll = useCallback(async () => {
    const [items, projs] = await Promise.all([
      boqService.getAll(),
      projectService.getAll(),
    ]);
    setAllItems(items);
    setProjects(projs);
  }, []);

  useEffect(() => {
    void reloadAll().catch((e) =>
      toast.error(e instanceof Error ? e.message : "טעינה נכשלה")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = useCallback(
    async (opts: { page: number; q: string; kind: KindFilter }) => {
      if (selectedProject === "all") return;
      const seq = ++requestSeq.current;
      setPageLoading(true);
      try {
        const res = await boqService.listPage({
          projectId: selectedProject,
          q: opts.q || undefined,
          itemKind: opts.kind,
          take: PAGE_SIZE,
          page: opts.page,
          sort: "code",
          dir: "asc",
        });
        if (seq !== requestSeq.current) return;
        setPagedItems(res.items);
        setPageTotal(res.pageInfo.total ?? res.total ?? 0);
      } catch (e) {
        if (seq === requestSeq.current) {
          toast.error(e instanceof Error ? e.message : "טעינה נכשלה");
        }
      } finally {
        if (seq === requestSeq.current) setPageLoading(false);
      }
    },
    [selectedProject, toast]
  );

  // Reset page when project changes
  useEffect(() => {
    setCurrentPage(1);
    setGlobalFilter("");
    setKindFilter("all");
  }, [selectedProject]);

  // Debounced load whenever filters or page change (server mode)
  useEffect(() => {
    if (!useServer) return;
    const handle = setTimeout(() => {
      void loadPage({ page: currentPage, q: globalFilter, kind: kindFilter });
    }, globalFilter ? 300 : 0);
    return () => clearTimeout(handle);
  }, [useServer, currentPage, globalFilter, kindFilter, loadPage]);

  function reload() {
    if (useServer) {
      void loadPage({ page: currentPage, q: globalFilter, kind: kindFilter });
    } else {
      void reloadAll();
    }
  }

  // Aggregates always come from the full local list (project scope only).
  // Server-mode pagination only affects the table view, not the summary cards.
  const filteredForAggregates =
    selectedProject === "all"
      ? allItems
      : allItems.filter((i) => i.projectId === selectedProject);

  const totalItems = useServer
    ? pageTotal || filteredForAggregates.length
    : filteredForAggregates.length;
  const regularCount = filteredForAggregates.filter(
    (i) => i.itemKind !== "exceptional"
  ).length;
  const exceptionalCount = filteredForAggregates.filter(
    (i) => i.itemKind === "exceptional"
  ).length;
  const totalContract = filteredForAggregates.reduce(
    (s, i) => s + i.contractQuantity * i.unitPrice,
    0
  );

  async function createExceptional(values: {
    code: string | null;
    description: string;
    unit: string;
    contractQuantity: number;
    unitPrice: number;
    category: string | null;
    notes: string | null;
    itemKind: "regular" | "exceptional";
    status: BoqItem["status"];
  }) {
    if (selectedProject === "all") {
      throw new Error("נא לבחור פרויקט לפני הוספת סעיף");
    }
    await boqService.create({
      projectId: selectedProject,
      ...values,
      itemKind: "exceptional",
    });
    toast.success("סעיף חריג נוסף");
    reload();
    void reloadAll();
  }

  const totalPages = useServer
    ? Math.max(1, Math.ceil(pageTotal / PAGE_SIZE))
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">כתבי כמויות</h1>
          <p className="text-sm text-gray-500 mt-1">
            ניהול סעיפים בלבד · דיווח ביצוע וחשבונות במסך חשבונות
          </p>
        </div>
        <div className="flex gap-2">
          {selectedProject !== "all" && (
            <Button onClick={() => setShowExceptionalModal(true)} variant="primary">
              <Plus className="h-4 w-4" />
              הוסף סעיף חריג
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedProject("all")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selectedProject === "all"
              ? "bg-primary-50 text-primary-700 font-medium"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          כל הפרויקטים
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selectedProject === p.id
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {p.name.split(" - ")[0]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-400 mb-1">סך סעיפים</p>
          <p className="text-xl font-bold text-gray-900">{totalItems}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">סעיפים רגילים</p>
          <p className="text-xl font-bold text-gray-900">{regularCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">סעיפים חריגים</p>
          <p className="text-xl font-bold text-amber-700">{exceptionalCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי חוזה כולל</p>
          <p className="text-xl font-bold text-primary-700">
            {formatCurrency(totalContract)}
          </p>
        </Card>
      </div>

      <BoqTable
        items={useServer ? pagedItems : filteredForAggregates}
        onItemsChanged={() => {
          reload();
          if (useServer) void reloadAll();
        }}
        serverMode={
          useServer
            ? {
                globalFilter,
                kindFilter,
                currentPage,
                pageSize: PAGE_SIZE,
                totalItems: pageTotal,
                totalPages,
                loading: pageLoading,
                onGlobalFilterChange: (v) => {
                  setCurrentPage(1);
                  setGlobalFilter(v);
                },
                onKindFilterChange: (v) => {
                  setCurrentPage(1);
                  setKindFilter(v);
                },
                onPageChange: setCurrentPage,
              }
            : undefined
        }
      />

      <BoqItemFormModal
        open={showExceptionalModal}
        mode="create-exceptional"
        onClose={() => setShowExceptionalModal(false)}
        onSubmit={createExceptional}
      />
    </div>
  );
}
