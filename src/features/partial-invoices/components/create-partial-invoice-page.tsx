"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, Progress } from "@/components/ui";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import { useInvoiceDraftStore } from "@/store/invoice-draft.store";
import { computeInvoiceLine, formatBillingMonth } from "@/utils/invoice-calc";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/format";
import { Trash2, ArrowRight } from "lucide-react";
import type { Project } from "@/types";

export function CreatePartialInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");

  const { projectId: draftProjectId, lines, setQuantity, removeLine, clear, setLines } =
    useInvoiceDraftStore();

  const projectId = projectIdParam || draftProjectId;

  const [project, setProject] = useState<Project | null>(null);
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [billingMonth, setBillingMonth] = useState(formatBillingMonth());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billTo, setBillTo] = useState("");
  const [contractor, setContractor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingUninvoiced, setLoadingUninvoiced] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    invoiceService
      .getNextSequence(projectId)
      .then((meta) => {
        setSequenceNumber(meta.sequenceNumber);
        setBillingMonth(meta.billingMonth);
        setProject(meta.project);
        setBillTo((prev) => prev || meta.project.name);
        setContractor((prev) => prev || meta.project.contractor);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינת פרטי חשבון")
      )
      .finally(() => setLoadingMeta(false));
  }, [projectId]);

  // Auto-load uninvoiced items when project changes
  useEffect(() => {
    if (!projectId || lines.length > 0) return;

    const loadUninvoicedItems = async () => {
      setLoadingUninvoiced(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/execution-reports/uninvoiced`);
        if (!response.ok) throw new Error("Failed to load uninvoiced items");
        
        const uninvoicedData = await response.json();
        
        if (uninvoicedData.length > 0) {
          // Convert uninvoiced items to draft lines
          const draftLines = uninvoicedData.map((item: any) => ({
            boqItemId: item.boqItemId,
            code: item.boqItem.code,
            description: item.boqItem.description,
            unit: item.boqItem.unit,
            contractQuantity: item.boqItem.contractQuantity,
            invoicedQuantity: item.totalInvoiced,
            availableForInvoice: item.pendingInvoice,
            quantity: item.pendingInvoice, // Auto-fill with pending quantity
            unitPrice: item.boqItem.unitPrice,
          }));
          
          setLines(draftLines);
        }
      } catch (err) {
        console.error("Error loading uninvoiced items:", err);
      } finally {
        setLoadingUninvoiced(false);
      }
    };

    loadUninvoicedItems();
  }, [projectId, lines.length, setLines]);

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const calc = computeInvoiceLine({
        contractQuantity: line.contractQuantity,
        previousQuantity: line.invoicedQuantity,
        currentQuantity: line.quantity,
        unitPrice: line.unitPrice,
      });
      return { ...line, ...calc };
    });
  }, [lines]);

  const totals = useMemo(() => {
    const current = computedLines.reduce((s, l) => s + l.currentAmount, 0);
    const cumulative = computedLines.reduce((s, l) => s + l.cumulativeAmount, 0);
    return { current, cumulative };
  }, [computedLines]);

  async function handleSave() {
    if (!projectId) {
      setError("יש לבחור פרויקט");
      return;
    }
    if (lines.length === 0) {
      setError("הוסיפו לפחות סעיף אחד מכתב הכמויות");
      return;
    }
    if (lines.some((l) => l.quantity <= 0 || l.quantity > l.availableForInvoice)) {
      setError("בדוק כמויות — ניתן לחייב רק כמות זמינה");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const invoice = await invoiceService.create({
        projectId,
        date,
        billingMonth,
        billTo,
        contractor,
        notes,
        items: lines.map((l) => ({
          boqItemId: l.boqItemId,
          quantity: l.quantity,
        })),
      });
      clear();
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירת החשבון");
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">יצירת חשבון חלקי</h1>
        <Card padding="lg">
          <p className="text-sm text-gray-600">
            בחרו סעיפים מכתב הכמויות באמצעות הכפתור &quot;הוסף לחשבון חלקי&quot;,
            או עברו לכתב כמויות של פרויקט.
          </p>
          <Button className="mt-4" onClick={() => router.push("/boq")}>
            מעבר לכתב כמויות
          </Button>
        </Card>
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
          <h1 className="text-2xl font-bold text-gray-900">יצירת חשבון חלקי</h1>
          <p className="text-sm text-gray-500 mt-1">
            חשבון מספר {sequenceNumber} · חודש {billingMonth}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => clear()} disabled={saving}>
            נקה טיוטה
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={lines.length === 0}>
            שמור חשבון
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <p className="text-xs text-gray-500 mb-1">סכום נוכחי</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(totals.current)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500 mb-1">סעיפים בחשבון</p>
          <p className="text-xl font-bold text-gray-900">{lines.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500 mb-1">התקדמות כספית פרויקט</p>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={project?.financialProgress ?? 0} size="sm" className="flex-1" />
            <span className="text-sm text-gray-600">
              {formatPercent(project?.financialProgress ?? 0)}
            </span>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="text-base font-semibold text-gray-900 mb-4">פרטי החשבון</h2>
        {loadingMeta ? (
          <p className="text-sm text-gray-400">טוען...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">מספר חשבון</label>
              <Input value={`חשבון ${sequenceNumber}`} disabled />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">חודש</label>
              <Input
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                placeholder="07/2026"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">תאריך</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">למי מוציאים</label>
              <Input value={billTo} onChange={(e) => setBillTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">קבלן</label>
              <Input
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">פרויקט</label>
              <Input value={project?.name ?? ""} disabled />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">הערות</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}
      </Card>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">טבלת החשבון</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/boq?projectId=${projectId}`)}
          >
            הוסף סעיפים מכתב כמויות
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-3">סעיף</th>
                <th className="text-right px-3 py-3">תיאור</th>
                <th className="text-right px-3 py-3">יחידה</th>
                <th className="text-right px-3 py-3">כמות חוזה</th>
                <th className="text-right px-3 py-3">מצטברת קודם</th>
                <th className="text-right px-3 py-3">כמות נוכחית</th>
                <th className="text-right px-3 py-3">מצטברת אחרי</th>
                <th className="text-right px-3 py-3">% כמותי</th>
                <th className="text-right px-3 py-3">מחיר יחידה</th>
                <th className="text-right px-3 py-3">סכום נוכחי</th>
                <th className="text-right px-3 py-3">סכום מצטבר</th>
                <th className="text-right px-3 py-3">% כספי</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {computedLines.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                    אין סעיפים בטיוטה. הוסיפו מכתב הכמויות.
                  </td>
                </tr>
              ) : (
                computedLines.map((line) => (
                  <tr key={line.boqItemId} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {line.code}
                    </td>
                    <td className="px-3 py-2 text-gray-900 max-w-[220px]">
                      {line.description}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{line.unit}</td>
                    <td className="px-3 py-2">{formatNumber(line.contractQuantity)}</td>
                    <td className="px-3 py-2">{formatNumber(line.invoicedQuantity)}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          setQuantity(line.boqItemId, Number(e.target.value))
                        }
                        className="w-24"
                        max={line.availableForInvoice}
                        min={0}
                        step="any"
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        זמין {formatNumber(line.availableForInvoice)}
                      </p>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatNumber(line.cumulativeQuantity)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Progress
                          value={line.quantityPercent}
                          size="sm"
                          className="w-12"
                        />
                        <span className="text-xs text-gray-500">
                          {formatPercent(line.quantityPercent)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-3 py-2 text-primary-700 font-medium">
                      {formatCurrency(line.currentAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(line.cumulativeAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {formatPercent(line.financialPercent)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeLine(line.boqItemId)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        title="הסר"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {computedLines.length > 0 && (
              <tfoot className="bg-gray-50/80 border-t border-gray-100">
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-sm font-medium text-gray-700">
                    סה״כ
                  </td>
                  <td className="px-3 py-3 text-sm font-bold text-primary-700">
                    {formatCurrency(totals.current)}
                  </td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900">
                    {formatCurrency(totals.cumulative)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
