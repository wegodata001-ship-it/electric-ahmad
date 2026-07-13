"use client";

import { useEffect, useState } from "react";
import { boqService } from "@/features/boq/services/boq.service";
import { projectService } from "@/services";
import type { BoqItem, Project } from "@/types";
import { BoqTable } from "./boq-table";
import { Card } from "@/components/ui";
import { formatCurrency } from "@/utils/format";

export function BoqPage() {
  const [items, setItems] = useState<BoqItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");

  useEffect(() => {
    boqService.getAll().then(setItems);
    projectService.getAll().then(setProjects);
  }, []);

  const filtered =
    selectedProject === "all"
      ? items
      : items.filter((i) => i.projectId === selectedProject);

  const totalContract = filtered.reduce((s, i) => s + i.contractQuantity * i.unitPrice, 0);
  const totalCompleted = filtered.reduce((s, i) => s + i.completedValue, 0);
  const totalRemaining = filtered.reduce((s, i) => s + i.remainingValue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">כתב כמויות</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} סעיפים</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי חוזה</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalContract)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי שבוצע</p>
          <p className="text-xl font-bold text-primary-600">{formatCurrency(totalCompleted)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי נותר</p>
          <p className="text-xl font-bold text-gray-600">{formatCurrency(totalRemaining)}</p>
        </Card>
      </div>

      <BoqTable items={filtered} />
    </div>
  );
}
