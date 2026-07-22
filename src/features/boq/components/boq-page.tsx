"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { boqService } from "@/features/boq/services/boq.service";
import { projectService } from "@/services";
import type { BoqItem, Project } from "@/types";
import { BoqTable } from "./boq-table";
import { BoqItemFormModal } from "./boq-item-form-modal";
import { Button, Card, useToast } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { Plus } from "lucide-react";

export function BoqPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const projectFromQuery = searchParams.get("projectId");

  const [items, setItems] = useState<BoqItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    projectFromQuery || "all"
  );
  const [showExceptionalModal, setShowExceptionalModal] = useState(false);

  useEffect(() => {
    if (projectFromQuery) setSelectedProject(projectFromQuery);
  }, [projectFromQuery]);

  function reload() {
    boqService.getAll().then(setItems);
    projectService.getAll().then(setProjects);
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered =
    selectedProject === "all"
      ? items
      : items.filter((i) => i.projectId === selectedProject);

  const totalItems = filtered.length;
  const regularCount = filtered.filter((i) => i.itemKind !== "exceptional").length;
  const exceptionalCount = filtered.filter((i) => i.itemKind === "exceptional").length;
  const totalContract = filtered.reduce(
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
  }

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

      <BoqTable items={filtered} onItemsChanged={reload} />

      <BoqItemFormModal
        open={showExceptionalModal}
        mode="create-exceptional"
        onClose={() => setShowExceptionalModal(false)}
        onSubmit={createExceptional}
      />
    </div>
  );
}
