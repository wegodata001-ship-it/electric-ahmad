"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import { formatNumber, formatCurrency, formatDate } from "@/utils/format";
import { ArrowRight, Receipt, Loader2 } from "lucide-react";
import type { Project } from "@/types";

type UninvoicedReport = {
  reportId: string;
  reportNumber: string;
  reportedAt: string;
  foremanName: string | null;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
};

/** Shape returned by getUninvoicedItems (grouped by BOQ item). */
type UninvoicedBoqGroup = {
  boqItemId: string;
  boqItem?: { unitPrice?: number | string };
  pendingInvoice?: number;
  reports?: Array<{
    reportId: string;
    reportNumber: string;
    reportedAt: string | Date;
    quantity: number;
  }>;
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function groupReportsByReport(groups: UninvoicedBoqGroup[]): UninvoicedReport[] {
  const reportMap = new Map<string, UninvoicedReport>();

  for (const group of groups) {
    const unitPrice = toNumber(group.boqItem?.unitPrice);
    for (const r of group.reports ?? []) {
      if (!r?.reportId) continue;
      const existing = reportMap.get(r.reportId);
      if (!existing) {
        reportMap.set(r.reportId, {
          reportId: r.reportId,
          reportNumber: r.reportNumber || "דיווח",
          reportedAt:
            typeof r.reportedAt === "string"
              ? r.reportedAt
              : r.reportedAt instanceof Date
                ? r.reportedAt.toISOString()
                : String(r.reportedAt ?? ""),
          foremanName: null,
          itemCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        });
      }
      const report = reportMap.get(r.reportId)!;
      report.itemCount += 1;
      report.totalQuantity += toNumber(r.quantity);
      report.totalValue += toNumber(r.quantity) * unitPrice;
    }
  }

  return Array.from(reportMap.values()).sort((a, b) =>
    a.reportedAt.localeCompare(b.reportedAt)
  );
}

function buildInvoiceItemsFromSelectedReports(
  groups: UninvoicedBoqGroup[],
  selectedReportIds: Set<string>
): { boqItemId: string; quantity: number }[] {
  const qtyByBoq = new Map<string, number>();

  for (const group of groups) {
    for (const r of group.reports ?? []) {
      if (!selectedReportIds.has(r.reportId)) continue;
      qtyByBoq.set(
        group.boqItemId,
        (qtyByBoq.get(group.boqItemId) ?? 0) + toNumber(r.quantity)
      );
    }
  }

  return Array.from(qtyByBoq.entries())
    .filter(([, quantity]) => quantity > 0)
    .map(([boqItemId, quantity]) => ({ boqItemId, quantity }));
}

export function SimpleInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [project, setProject] = useState<Project | null>(null);
  const [groups, setGroups] = useState<UninvoicedBoqGroup[]>([]);
  const [reports, setReports] = useState<UninvoicedReport[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    Promise.all([
      invoiceService.getNextSequence(projectId),
      fetch(`/api/projects/${projectId}/execution-reports?status=uninvoiced`).then(
        (r) => r.json()
      ),
    ])
      .then(([meta, reportsData]) => {
        setProject(meta.project);

        const list: UninvoicedBoqGroup[] = Array.isArray(reportsData)
          ? reportsData
          : Array.isArray(reportsData?.data)
            ? reportsData.data
            : [];

        setGroups(list);
        setReports(groupReportsByReport(list));
      })
      .catch((err) => {
        console.error(err);
        setError("שגיאה בטעינת דיווחים");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const toggleReport = (reportId: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedReports.size === reports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports.map((r) => r.reportId)));
    }
  };

  const selectedReportsData = reports.filter((r) =>
    selectedReports.has(r.reportId)
  );
  const totalAmount = selectedReportsData.reduce(
    (sum, r) => sum + r.totalValue,
    0
  );

  const handleCreateInvoice = async () => {
    if (!projectId || selectedReports.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      const items = buildInvoiceItemsFromSelectedReports(groups, selectedReports);

      if (items.length === 0) {
        throw new Error("לא נמצאו פריטים לחיוב");
      }

      const invoice = await invoiceService.create({
        projectId,
        date: new Date().toISOString().slice(0, 10),
        billingMonth: new Date().toLocaleDateString("he-IL", {
          month: "long",
          year: "numeric",
        }),
        billTo: project?.name || "",
        contractor: project?.contractor || "",
        notes: `דיווחים: ${selectedReportsData.map((r) => r.reportNumber).join(", ")}`,
        items,
        reportIds: Array.from(selectedReports),
      });

      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "שגיאה ביצירת חשבון");
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">הוצאת חשבון</h1>
        <Card padding="lg">
          <p className="text-sm text-gray-600">
            בחרו פרויקט כדי להציג דיווחים זמינים
          </p>
          <Button className="mt-4" onClick={() => router.push("/boq")}>
            מעבר לכתב כמויות
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push("/invoices")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לחשבונות
          </button>
          <h1 className="text-2xl font-bold text-gray-900">הוצאת חשבון</h1>
          <p className="text-sm text-gray-500 mt-1">{project?.name}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {reports.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">אין דיווחים זמינים לחיוב</p>
            <p className="text-sm text-gray-500 mt-1">
              יצרו דיווח ביצוע חדש מכתב הכמויות
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/boq?projectId=${projectId}`)}
            >
              מעבר לכתב כמויות
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card padding="md">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  reports.length > 0 && selectedReports.size === reports.length
                }
                onChange={toggleAll}
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-900">
                בחר הכל ({reports.length} דיווחים)
              </span>
            </label>
          </Card>

          <div className="space-y-3">
            {reports.map((report) => (
              <Card
                key={report.reportId}
                padding="md"
                className={
                  selectedReports.has(report.reportId)
                    ? "ring-2 ring-primary-500"
                    : ""
                }
              >
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedReports.has(report.reportId)}
                    onChange={() => toggleReport(report.reportId)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {report.reportNumber}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatDate(report.reportedAt)}
                          {report.foremanName && ` · ${report.foremanName}`}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg text-gray-900">
                          {formatCurrency(report.totalValue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {report.itemCount} סעיפים ·{" "}
                          {formatNumber(report.totalQuantity)} יח&apos;
                        </p>
                      </div>
                    </div>
                  </div>
                </label>
              </Card>
            ))}
          </div>

          <Card padding="lg" className="sticky bottom-4 shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-gray-500">
                  {selectedReports.size} דיווחים נבחרו
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <Button
                onClick={handleCreateInvoice}
                disabled={selectedReports.size === 0 || saving}
                size="lg"
              >
                {saving && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
                <Receipt className="h-5 w-5 ml-2" />
                📄 העבר לחשבון
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
