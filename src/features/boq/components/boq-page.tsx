"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { boqService } from "@/features/boq/services/boq.service";
import { projectService } from "@/services";
import type { BoqItem, Project, Employee } from "@/types";
import { BoqTable } from "./boq-table";
import { Button, Card, useToast } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { Plus } from "lucide-react";
import { ExecutionReportModal } from "@/features/projects/components/execution-report-modal";

export function BoqPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const projectFromQuery = searchParams.get("projectId");

  const [items, setItems] = useState<BoqItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [foremen, setForemen] = useState<Employee[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    projectFromQuery || "all"
  );
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (projectFromQuery) setSelectedProject(projectFromQuery);
  }, [projectFromQuery]);

  function reload() {
    boqService.getAll().then(setItems);
    projectService.getAll().then(setProjects);
  }

  async function loadForemen() {
    try {
      const response = await fetch("/api/employees?role=foreman");
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        setForemen(Array.isArray(data) ? data : []);
      } else {
        setForemen([]);
      }
    } catch (error) {
      console.error("Error loading foremen:", error);
      setForemen([]);
    }
  }

  useEffect(() => {
    reload();
    loadForemen();
  }, []);

  const filtered =
    selectedProject === "all"
      ? items
      : items.filter((i) => i.projectId === selectedProject);

  const totalContract = filtered.reduce(
    (s, i) => s + i.contractQuantity * i.unitPrice,
    0
  );
  const totalCompleted = filtered.reduce((s, i) => s + i.completedValue, 0);
  const totalInvoiced = filtered.reduce(
    (s, i) => s + (i.invoicedQuantity ?? 0) * i.unitPrice,
    0
  );
  const totalAvailable = filtered.reduce(
    (s, i) => s + (i.availableForInvoice ?? 0) * i.unitPrice,
    0
  );

  const handleOpenReportModal = () => {
    if (selectedProject === "all") {
      toast.error("נא לבחור פרויקט ספציפי לפני דיווח ביצוע");
      return;
    }
    setShowReportModal(true);
  };

  const boqItemsForReport = filtered.map((item) => ({
    id: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    contractQuantity: item.contractQuantity,
    completedQuantity: item.completedQuantity,
    remainingQuantity: item.remainingQuantity,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">כתבי כמויות</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} סעיפים</p>
        </div>
        <div className="flex gap-2">
          {selectedProject !== "all" && (
            <Button
              onClick={handleOpenReportModal}
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              דווח ביצוע
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
          <p className="text-xs text-gray-400 mb-1">שווי חוזה</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(totalContract)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי שבוצע</p>
          <p className="text-xl font-bold text-primary-600">
            {formatCurrency(totalCompleted)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי שחויב</p>
          <p className="text-xl font-bold text-gray-700">
            {formatCurrency(totalInvoiced)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">זמין לחשבון</p>
          <p className="text-xl font-bold text-emerald-700">
            {formatCurrency(totalAvailable)}
          </p>
        </Card>
      </div>

      <BoqTable items={filtered} onItemsChanged={reload} />

      {selectedProject !== "all" && (
        <ExecutionReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          projectId={selectedProject}
          boqItems={boqItemsForReport}
          foremen={foremen}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
