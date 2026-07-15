"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import { boqService } from "@/features/boq/services/boq.service";
import { computeInvoiceLine } from "@/utils/invoice-calc";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/format";
import { INVOICE_STATUS_LABELS } from "@/constants";
import type { BoqItem, InvoiceStatus, PartialInvoice } from "@/types";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

type EditLine = {
  key: string;
  boqItemId: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  previousQuantity: number;
  quantity: number;
  unitPrice: number;
  availableMax: number;
};

const EDITABLE_STATUSES = [
  "draft",
  "pending_foreman_approval",
  "approved_by_foreman",
  "rejected_by_foreman",
  "sent_to_client",
  "paid",
  "submitted",
  "approved",
  "rejected",
] as const;

function wasSent(status: InvoiceStatus) {
  return status === "sent_to_client" || status === "paid";
}

export function EditPartialInvoicePage({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<PartialInvoice | null>(null);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [date, setDate] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [billTo, setBillTo] = useState("");
  const [contractor, setContractor] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackSent, setAckSent] = useState(false);
  const [addBoqId, setAddBoqId] = useState("");

  useEffect(() => {
    invoiceService
      .getById(invoiceId)
      .then(async (inv) => {
        setInvoice(inv);
        setDate(inv.date.slice(0, 10));
        setBillingMonth(inv.billingMonth || "");
        setStatus(inv.status);
        setBillTo(inv.billTo || "");
        setContractor(inv.contractor || "");
        setNotes(inv.notes || "");

        const boq = await boqService.getByProject(inv.projectId);
        setBoqItems(boq);

        // Available = executed - invoiced + this invoice's qty for that BOQ
        const qtyOnThis = new Map<string, number>();
        for (const item of inv.includedItems) {
          qtyOnThis.set(
            item.boqItemId,
            (qtyOnThis.get(item.boqItemId) ?? 0) + item.quantity
          );
        }

        setLines(
          inv.includedItems.map((item, idx) => {
            const boqRow = boq.find((b) => b.id === item.boqItemId);
            const executed = boqRow?.executedQuantity ?? 0;
            const invoiced = boqRow?.invoicedQuantity ?? 0;
            const released = qtyOnThis.get(item.boqItemId) ?? 0;
            const availableMax = Math.max(
              0,
              executed - invoiced + released
            );
            // Previous = already invoiced excluding this invoice (live cumulative)
            const previousQuantity = Math.max(0, invoiced - released);
            return {
              key: item.id || `${item.boqItemId}-${idx}`,
              boqItemId: item.boqItemId,
              code: item.code,
              description: item.description,
              unit: item.unit,
              contractQuantity: item.contractQuantity,
              previousQuantity,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              availableMax,
            };
          })
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const calc = computeInvoiceLine({
        contractQuantity: line.contractQuantity,
        previousQuantity: line.previousQuantity,
        currentQuantity: line.quantity,
        unitPrice: line.unitPrice,
      });
      return { ...line, ...calc };
    });
  }, [lines]);

  const totals = useMemo(() => {
    const amount = computedLines.reduce((s, l) => s + l.currentAmount, 0);
    const cumulative = computedLines.reduce((s, l) => s + l.cumulativeAmount, 0);
    return { amount, cumulative };
  }, [computedLines]);

  function updateLine(key: string, patch: Partial<EditLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }

  function addLine() {
    if (!addBoqId) return;
    const boq = boqItems.find((b) => b.id === addBoqId);
    if (!boq) return;
    if (lines.some((l) => l.boqItemId === addBoqId)) {
      setError("הסעיף כבר קיים בחשבון");
      return;
    }
    const qtyOnThis = lines
      .filter((l) => l.boqItemId === addBoqId)
      .reduce((s, l) => s + l.quantity, 0);
    const availableMax = Math.max(
      0,
      boq.executedQuantity - boq.invoicedQuantity + qtyOnThis
    );
    setLines((prev) => [
      ...prev,
      {
        key: `new-${addBoqId}-${Date.now()}`,
        boqItemId: boq.id,
        code: boq.code,
        description: boq.description,
        unit: boq.unit,
        contractQuantity: boq.contractQuantity,
        previousQuantity: boq.invoicedQuantity,
        quantity: Math.min(1, availableMax) || 0,
        unitPrice: boq.unitPrice,
        availableMax,
      },
    ]);
    setAddBoqId("");
    setError(null);
  }

  async function handleSave() {
    if (!invoice) return;
    if (wasSent(status) && !ackSent) {
      setError("יש לאשר את ההתראה לפני שמירה (חשבון שנשלח/שולם)");
      return;
    }
    if (lines.length === 0) {
      setError("יש להשאיר לפחות סעיף אחד");
      return;
    }
    if (lines.some((l) => !(l.quantity > 0) || l.quantity > l.availableMax + 1e-9)) {
      setError("בדוק כמויות — חריגה מהכמות הזמינה");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await invoiceService.update(invoiceId, {
        date,
        billingMonth,
        billTo,
        contractor,
        notes,
        status,
        items: lines.map((l) => ({
          boqItemId: l.boqItemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          description: l.description,
          unit: l.unit,
        })),
      });
      router.push(`/invoices/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">טוען חשבון לעריכה...</p>;
  }

  if (!invoice) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error || "חשבון לא נמצא"}</p>
      </Card>
    );
  }

  const sent = wasSent(status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push(`/invoices/${invoiceId}`)}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לחשבון
          </button>
          <h1 className="text-2xl font-bold text-gray-900">עריכת חשבון</h1>
          <p className="text-sm text-gray-500 mt-1">
            {invoice.invoiceNumber} (מספר קבוע) · {invoice.projectName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/invoices/${invoiceId}`)}
          >
            ביטול
          </Button>
          <Button onClick={handleSave} loading={saving}>
            שמור שינויים
          </Button>
        </div>
      </div>

      {sent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
          <p>
            החשבון כבר נשלח ללקוח / שולם. לאחר השמירה יעודכנו הסכומים, כתב
            הכמויות, הדשבורד והמסמכים.
          </p>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={ackSent}
              onChange={(e) => setAckSent(e.target.checked)}
            />
            אני מאשר/ת את העדכון
          </label>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold mb-4">פרטי החשבון</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="מספר חשבון">
            <Input value={invoice.invoiceNumber} disabled />
          </Field>
          <Field label="תאריך">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="חודש החשבון">
            <Input
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              placeholder="MM/YYYY"
            />
          </Field>
          <Field label="סטטוס">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white"
            >
              {EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="לקוח / Bill To">
            <Input value={billTo} onChange={(e) => setBillTo(e.target.value)} />
          </Field>
          <Field label="קבלן / איש קשר">
            <Input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
            />
          </Field>
          <Field label="פרויקט">
            <Input value={invoice.projectName} disabled />
          </Field>
          <Field label="מנהל עבודה">
            <Input value={invoice.projectForemanName || "—"} disabled />
          </Field>
          <Field label="כתובת פרויקט">
            <Input value={invoice.projectLocation || "—"} disabled />
          </Field>
          <Field label="הערות" className="md:col-span-2 lg:col-span-3">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">שורות החשבון</h2>
          <div className="flex gap-2 items-center">
            <select
              value={addBoqId}
              onChange={(e) => setAddBoqId(e.target.value)}
              className="h-9 px-2 text-sm border border-gray-200 rounded-lg max-w-[240px]"
            >
              <option value="">הוסף סעיף מכתב כמויות...</option>
              {boqItems.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.description}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              הוסף
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-3">קוד</th>
                <th className="text-right px-3 py-3">תיאור</th>
                <th className="text-right px-3 py-3">יחידה</th>
                <th className="text-right px-3 py-3">כמות</th>
                <th className="text-right px-3 py-3">מחיר יחידה</th>
                <th className="text-right px-3 py-3">סה״כ שורה</th>
                <th className="text-right px-3 py-3">מצטבר</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {computedLines.map((line) => (
                <tr key={line.key} className="border-t border-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {line.code}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      className="min-w-[160px]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.unit}
                      onChange={(e) =>
                        updateLine(line.key, { unit: e.target.value })
                      }
                      className="w-20"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="any"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                      className="w-24"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      מקס׳ {formatNumber(line.availableMax)}
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPrice: Number(e.target.value) || 0,
                        })
                      }
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {formatCurrency(line.currentAmount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {formatCurrency(line.cumulativeAmount)}
                    <span className="text-xs mr-1">
                      ({formatPercent(line.financialPercent)})
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((l) => l.key !== line.key)
                        )
                      }
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-8 text-sm">
          <div>
            <p className="text-xs text-gray-500">סך החשבון (נוכחי)</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(totals.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">מצטבר כולל</p>
            <p className="text-lg font-semibold text-gray-700">
              {formatCurrency(totals.cumulative)}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/invoices/${invoiceId}`)}
        >
          ביטול
        </Button>
        <Button onClick={handleSave} loading={saving}>
          שמור שינויים
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
