"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatNumber } from "@/utils/format";
import { ClipboardList, FileCheck2, FileClock, Loader2 } from "lucide-react";

type ReportStatus = "draft" | "submitted" | "approved" | "cancelled";

type ExecutionReportRow = {
  id: string;
  reportNumber: string;
  reportedAt: string;
  status: ReportStatus;
  notes: string | null;
  project: { id: string; name: string; contractNumber: string };
  foremanName: string | null;
  itemCount: number;
  totalQuantity: number;
  invoicedItemCount: number;
  items: {
    id: string;
    code: string;
    description: string;
    unit: string;
    quantity: number;
    invoiced: boolean;
    invoiceId: string | null;
  }[];
};

const STATUS: Record<
  ReportStatus,
  { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }
> = {
  draft: { label: "טיוטה", variant: "default" },
  submitted: { label: "דווח", variant: "primary" },
  approved: { label: "אושר", variant: "success" },
  cancelled: { label: "בוטל", variant: "danger" },
};

export function ExecutionReportsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const foremanId = searchParams.get("foremanId");
  const [reports, setReports] = useState<ExecutionReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (foremanId) params.set("foremanId", foremanId);

    fetch(`/api/execution-reports?${params.toString()}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error || "שגיאה בטעינת דיווחים");
        }
        return json.data as ExecutionReportRow[];
      })
      .then(setReports)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינת דיווחים")
      )
      .finally(() => setLoading(false));
  }, [foremanId, projectId]);

  const stats = useMemo(
    () => ({
      reports: reports.length,
      items: reports.reduce((sum, report) => sum + report.itemCount, 0),
      pending: reports.reduce(
        (sum, report) => sum + report.itemCount - report.invoicedItemCount,
        0
      ),
      invoiced: reports.reduce(
        (sum, report) => sum + report.invoicedItemCount,
        0
      ),
    }),
    [reports]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דיווחי ביצוע</h1>
        <p className="text-sm text-gray-500 mt-1">
          דיווחים שנשמרו מכתב הכמויות — מקור המידע לביצוע ולחיוב
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-xs text-gray-500">דיווחים</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.reports}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">סעיפים שדווחו</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.items}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">ממתינים לחיוב</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">כבר חויבו</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.invoiced}</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <Card padding="md">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      ) : reports.length === 0 ? (
        <Card padding="lg">
          <div className="py-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-11 w-11 text-gray-300" />
            <p className="font-medium text-gray-700">אין דיווחי ביצוע להצגה</p>
            <p className="mt-1 text-sm text-gray-500">
              ניתן ליצור דיווח חדש מתוך כתב הכמויות של הפרויקט.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const status = STATUS[report.status];
            const isExpanded = expandedId === report.id;
            const pending = report.itemCount - report.invoicedItemCount;

            return (
              <Card key={report.id} padding="md">
                <button
                  type="button"
                  className="w-full text-right"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === report.id ? null : report.id
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">
                          {report.reportNumber}
                        </p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {report.project.name} · {formatDate(report.reportedAt)}
                        {report.foremanName ? ` · ${report.foremanName}` : ""}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">
                        {report.itemCount} סעיפים
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(report.totalQuantity)} יח׳
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.invoicedItemCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        {report.invoicedItemCount} חויבו
                      </span>
                    ) : null}
                    {pending > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <FileClock className="h-3.5 w-3.5" />
                        {pending} ממתינים לחיוב
                      </span>
                    ) : null}
                  </div>
                </button>

                {isExpanded ? (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    {report.notes ? (
                      <p className="mb-3 text-sm text-gray-600">{report.notes}</p>
                    ) : null}
                    <div className="space-y-2 md:hidden">
                      {report.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg bg-gray-50 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">
                                {item.code} · {item.description}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatNumber(item.quantity)} {item.unit}
                              </p>
                            </div>
                            <Badge variant={item.invoiced ? "success" : "warning"}>
                              {item.invoiced ? "חויב" : "ממתין לחיוב"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="text-right text-xs text-gray-500">
                          <tr className="border-b border-gray-100">
                            <th className="px-2 py-2">סעיף</th>
                            <th className="px-2 py-2">תיאור</th>
                            <th className="px-2 py-2">כמות</th>
                            <th className="px-2 py-2">מצב חיוב</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="px-2 py-2 font-medium">{item.code}</td>
                              <td className="px-2 py-2">{item.description}</td>
                              <td className="px-2 py-2">
                                {formatNumber(item.quantity)} {item.unit}
                              </td>
                              <td className="px-2 py-2">
                                <Badge variant={item.invoiced ? "success" : "warning"}>
                                  {item.invoiced ? "חויב" : "ממתין לחיוב"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
