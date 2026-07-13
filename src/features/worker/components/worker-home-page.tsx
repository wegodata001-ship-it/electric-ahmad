"use client";

import { useEffect, useState } from "react";
import { employeeService } from "@/features/employees/services/employee.service";
import { boqService } from "@/features/boq/services/boq.service";
import { reportService } from "@/features/reports/services/report.service";
import type { BoqItem, WorkReport, Employee } from "@/types";
import { Card, Progress, Badge, Button } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { BOQ_STATUS_LABELS, BOQ_STATUS_COLORS } from "@/constants";
import { Plus } from "lucide-react";

export function WorkerHomePage() {
  const [items, setItems] = useState<BoqItem[]>([]);
  const [worker, setWorker] = useState<Employee | null>(null);

  useEffect(() => {
    employeeService.getAll().then((employees) => {
      const w = employees.find((e) => e.role === "worker") ?? employees[0];
      if (!w) return;
      setWorker(w);
      if (w.projectIds.length > 0) {
        boqService.getByProject(w.projectIds[0]).then(setItems);
      }
      reportService.getByEmployee(w.id);
    });
  }, []);

  if (!worker) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const openItems = items.filter((i) => i.status !== "completed");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">שלום,</p>
        <h1 className="text-xl font-bold text-gray-900">{worker.fullName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm">
          <p className="text-xs text-gray-400">בוצע</p>
          <p className="text-lg font-bold text-primary-600">{formatNumber(worker.completedQuantity)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-400">פתוח</p>
          <p className="text-lg font-bold text-gray-600">{formatNumber(worker.openQuantity)}</p>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">העבודות שלי</h2>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            דיווח
          </Button>
        </div>

        <div className="space-y-3">
          {openItems.slice(0, 8).map((item) => (
            <Card key={item.id} padding="sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-mono text-gray-400">{item.code}</span>
                  <p className="text-sm font-medium text-gray-900">{item.description}</p>
                </div>
                <Badge className={BOQ_STATUS_COLORS[item.status]}>
                  {BOQ_STATUS_LABELS[item.status]}
                </Badge>
              </div>
              <Progress value={item.progress} size="sm" showLabel />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>נותר: {formatNumber(item.remainingQuantity)} {item.unit}</span>
                <span>מתוך {formatNumber(item.contractQuantity)}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
