"use client";

import { useEffect, useState } from "react";
import { employeeService } from "@/features/employees/services/employee.service";
import { reportService } from "@/features/reports/services/report.service";
import type { DailyReport } from "@/types";
import { Card } from "@/components/ui";
import { formatRelative } from "@/utils/format";

export function WorkerReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeeService.getAll().then((employees) => {
      const worker = employees.find((e) => e.role === "worker") ?? employees[0];
      if (worker) {
        reportService.getByEmployee(worker.id).then((data) => {
          setReports(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">הדיווחים שלי</h1>
        <p className="text-sm text-gray-500 mt-1">{reports.length} דיווחים</p>
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <Card key={report.id} padding="sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">
                {report.projectName}
              </p>
              <span className="text-xs text-gray-400">
                {formatRelative(report.submittedAt)}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {report.workersCount} עובדים · {report.totalHours.toFixed(1)} שעות
            </p>
            {report.actionsPerformed && (
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2 line-clamp-2">
                {report.actionsPerformed}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
