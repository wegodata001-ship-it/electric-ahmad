"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  History,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "../services/invoices-workspace.service";
import { formatNumber } from "@/utils/format";
import {
  calculateMeasurementQuantity,
  hasMeasurementData,
} from "@/lib/measurement/quantities";

export function MeasurementSheetEditorPage({ sheetId }: { sheetId: string }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [rowBusy, setRowBusy] = useState(false);

  useEffect(() => {
    invoicesWorkspaceService
      .getSheet(sheetId)
      .then((s) => {
        setSheet(s);
        const next: Record<string, string> = {};
        for (const c of s.cells ?? []) {
          next[`${c.rowId}:${c.boqItemId}`] = String(c.quantity ?? 0);
        }
        setDraft(next);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  async function reload() {
    const s = await invoicesWorkspaceService.getSheet(sheetId);
    setSheet(s);
    const next: Record<string, string> = {};
    for (const c of s.cells ?? []) {
      next[`${c.rowId}:${c.boqItemId}`] = String(c.quantity ?? 0);
    }
    setDraft(next);
  }

  const columns = useMemo(() => {
    if (!sheet) return [];
    const map = new Map<string, any>();
    for (const c of sheet.cells ?? []) {
      if (c.boqItem) map.set(c.boqItemId, c.boqItem);
    }
    return [...map.values()].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "he")
    );
  }, [sheet]);

  const locked = sheet?.editable === false;

  async function saveCell(rowId: string, boqItemId: string) {
    const key = `${rowId}:${boqItemId}`;
    const quantity = Number(draft[key] ?? 0);
    setSavingKey(key);
    try {
      await invoicesWorkspaceService.setCell(sheetId, { rowId, boqItemId, quantity });
      toast.success("נשמר");
    } catch (e: any) {
      toast.error(e.message);
      await reload();
    } finally {
      setSavingKey(null);
    }
  }

  async function loadHistory() {
    setShowHistory(true);
    try {
      const r = await invoicesWorkspaceService.getEntries(sheetId);
      setEntries(r.items);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function addRow() {
    setRowBusy(true);
    try {
      await invoicesWorkspaceService.addRows(sheetId, ["שורה חדשה"]);
      await reload();
      toast.success("נוספה שורה חדשה");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowBusy(false);
    }
  }

  async function renameRow(row: any) {
    const name = window.prompt("שם השורה", row.name)?.trim();
    if (!name || name === row.name) return;
    setRowBusy(true);
    try {
      await invoicesWorkspaceService.renameRow(sheetId, row.id, name);
      await reload();
      toast.success("שם השורה עודכן");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowBusy(false);
    }
  }

  async function deleteRow(row: any) {
    const values = columns.map(
      (column) => Number(draft[`${row.id}:${column.id}`] ?? 0)
    );
    const warning = hasMeasurementData(values)
      ? "בשורה זו קיימים נתוני מדידה. מחיקת השורה תסיר את הנתונים מהטיוטה הנוכחית. האם להמשיך?"
      : `למחוק את השורה "${row.name}"?`;
    if (!window.confirm(warning)) return;
    setRowBusy(true);
    try {
      await invoicesWorkspaceService.deleteRow(sheetId, row.id);
      await reload();
      toast.success("השורה נמחקה");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowBusy(false);
    }
  }

  async function renameTitle() {
    const title = window.prompt("כותרת המדידה", sheet.title)?.trim();
    if (!title || title === sheet.title) return;
    try {
      const updated = await invoicesWorkspaceService.updateSheet(sheetId, {
        title,
      });
      setSheet(updated);
      toast.success("כותרת המדידה עודכנה");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">טוען דף מדידה…</p>;
  if (!sheet) return <p className="p-6 text-red-600">דף מדידה לא נמצא</p>;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href={`/invoices?projectId=${sheet.projectId}`}
          className="text-gray-500 mt-1"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{sheet.title}</h1>
            {!locked && (
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => void renameTitle()}
                title="שינוי כותרת"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {sheet.project?.name} · דף #{sheet.sequenceNumber}
            {locked ? " · נעול" : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadHistory}>
          <History className="h-4 w-4" />
          היסטוריה
        </Button>
      </div>

      {!locked && (
        <Button size="sm" onClick={() => void addRow()} disabled={rowBusy}>
          <Plus className="h-4 w-4" />
          + הוסף שורה
        </Button>
      )}

      {!columns.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">אין עמודות להזנה בדף זה</p>
          <p className="mt-1">
            נצור סעיפי בסיס ונפתח את הטבלה למילוי.
          </p>
          <Button
            className="mt-3"
            size="sm"
            onClick={async () => {
              try {
                const s = await invoicesWorkspaceService.ensureGrid(sheetId, true);
                setSheet(s);
                const next: Record<string, string> = {};
                for (const c of s.cells ?? []) {
                  next[`${c.rowId}:${c.boqItemId}`] = String(c.quantity ?? 0);
                }
                setDraft(next);
                toast.success("טבלת המדידה מוכנה");
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          >
            הצג טבלה למילוי
          </Button>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white max-h-[70vh]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap border-b">
                שורה / יחידה
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-2 py-3 text-center font-semibold text-gray-600 border-b min-w-[110px]"
                  title={col.description}
                >
                  <div className="font-mono text-xs">{col.code}</div>
                  <div className="text-[10px] font-normal text-gray-400 line-clamp-2 max-w-[120px] mx-auto">
                    {col.description}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sheet.rows ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2 font-medium whitespace-nowrap sticky right-0 bg-white">
                  <span className="inline-flex items-center gap-2">
                    {row.name}
                    {!locked && (
                      <details className="relative">
                        <summary className="list-none cursor-pointer rounded p-1 hover:bg-gray-100">
                          <MoreVertical className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 min-w-32 rounded-lg border bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-50"
                            onClick={() => void renameRow(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            שינוי שם
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => void deleteRow(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            מחיקת שורה
                          </button>
                        </div>
                      </details>
                    )}
                  </span>
                </td>
                {columns.map((col) => {
                  const key = `${row.id}:${col.id}`;
                  const busy = savingKey === key;
                  return (
                    <td key={col.id} className="px-1 py-1">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={locked}
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm disabled:bg-gray-50"
                          value={draft[key] ?? "0"}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [key]: e.target.value }))
                          }
                          onBlur={() => {
                            if (!locked) saveCell(row.id, col.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                        {busy && <Save className="h-3 w-3 text-primary-500 animate-pulse" />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-3 py-2">סה״כ שבוצע (מצטבר)</td>
              {columns.map((col) => {
                const current = (sheet.rows ?? []).reduce((s: number, row: any) => {
                  const key = `${row.id}:${col.id}`;
                  return s + (Number(draft[key]) || 0);
                }, 0);
                const metrics = calculateMeasurementQuantity({
                  contractQuantity: Number(col.contractQuantity) || 0,
                  previousApprovedQuantity:
                    Number(
                      col.previousApprovedQuantity ?? col.invoicedQuantity
                    ) || 0,
                  currentQuantity: current,
                });
                return (
                  <td key={col.id} className="px-2 py-2 text-center">
                    {formatNumber(metrics.cumulativeQuantity)}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t bg-gray-50 font-semibold">
              <td className="px-3 py-2">יתרה</td>
              {columns.map((col) => {
                const current = (sheet.rows ?? []).reduce(
                  (sum: number, row: any) =>
                    sum + (Number(draft[`${row.id}:${col.id}`]) || 0),
                  0
                );
                const metrics = calculateMeasurementQuantity({
                  contractQuantity: Number(col.contractQuantity) || 0,
                  previousApprovedQuantity:
                    Number(
                      col.previousApprovedQuantity ?? col.invoicedQuantity
                    ) || 0,
                  currentQuantity: current,
                });
                return (
                  <td
                    key={col.id}
                    className={`px-2 py-2 text-center ${
                      metrics.isOverrun ? "text-red-700" : ""
                    }`}
                  >
                    {formatNumber(metrics.remainingQuantity)}
                    {metrics.isOverrun && (
                      <span className="block text-[10px]">
                        חריגה מכמות חוזה
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {showHistory && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 max-h-80 overflow-y-auto">
          <div className="flex justify-between">
            <h3 className="font-bold">היסטוריית הזנות</h3>
            <button
              type="button"
              className="text-sm text-gray-500"
              onClick={() => setShowHistory(false)}
            >
              סגור
            </button>
          </div>
          {!entries.length && <p className="text-sm text-gray-500">אין רשומות</p>}
          {entries.map((e) => (
            <div key={e.id} className="text-sm border-b border-gray-50 pb-2">
              <p>
                {e.actor?.name}: {e.oldQuantity ?? "—"} → {e.newQuantity}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(e.createdAt).toLocaleString("he-IL")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
