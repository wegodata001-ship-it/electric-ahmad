"use client";

import { useEffect, useState } from "react";
import { reportService } from "@/features/reports/services/report.service";
import type { WorkReport } from "@/types";
import { Card, Avatar, Timeline } from "@/components/ui";
import { formatRelative } from "@/utils/format";
import { Camera, Video } from "lucide-react";
import Image from "next/image";

export function ReportsPage() {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    reportService.getAll().then(setReports);
  }, []);

  const today = new Date().toDateString();
  const filtered =
    filter === "today"
      ? reports.filter((r) => new Date(r.reportedAt).toDateString() === today)
      : filter === "week"
        ? reports.filter((r) => {
            const d = new Date(r.reportedAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return d > weekAgo;
          })
        : reports;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דיווחים</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} דיווחים</p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "all", label: "הכל" },
          { id: "today", label: "היום" },
          { id: "week", label: "שבוע אחרון" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.id
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((report) => (
          <Card key={report.id}>
            <div className="flex items-start gap-4">
              <Avatar name={report.employeeName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">{report.employeeName}</p>
                  <span className="text-xs text-gray-400">{formatRelative(report.reportedAt)}</span>
                </div>
                <p className="text-sm text-gray-700">
                  דיווח <span className="font-semibold text-primary-600">{report.quantity} {report.unit}</span>
                  {" "}בסעיף <span className="font-medium">{report.boqItemDescription}</span>
                  <span className="text-gray-400 mr-1">({report.boqItemCode})</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{report.projectName}</p>
                {report.notes && (
                  <p className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">{report.notes}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {report.photoUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Camera className="h-3.5 w-3.5" />
                      {report.photoUrls.length} תמונות
                    </span>
                  )}
                  {report.videoUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Video className="h-3.5 w-3.5" />
                      {report.videoUrls.length} סרטונים
                    </span>
                  )}
                </div>
                {report.photoUrls.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {report.photoUrls.map((url, i) => (
                      <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden">
                        <Image src={url} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
