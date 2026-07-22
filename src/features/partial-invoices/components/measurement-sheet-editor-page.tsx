"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, History, Plus, Save } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "../services/invoices-workspace.service";
import { formatNumber } from "@/utils/format";

export function MeasurementSheetEditorPage({ sheetId }: { sheetId: string }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newRowName, setNewRowName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);

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

  const locked = sheet?.status === "invoiced" || sheet?.status === "locked";

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

  async function addRow() {
    if (!newRowName.trim()) return;
    try {
      await invoicesWorkspaceService.addRows(sheetId, [newRowName.trim()]);
      setNewRowName("");
      await reload();
      toast.success("יחידה נוספה");
    } catch (e: any) {
      toast.error(e.message);
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

  if (loading) return <p className="p-6 text-sm text-gray-500">טוען דף מדידה…</p>;
  if (!sheet) return <p className="p-6 text-red-600">דף מדידה לא נמצא</p>;

  const axis =
    sheet.project?.measurementAxisLabel ||
    ({ room: "חדר", floor: "קומה", building: "בניין", area: "אזור" } as any)[
      sheet.project?.measurementAxisType
    ] ||
    "יחידה";

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
          <h1 className="text-xl font-bold text-gray-900">{sheet.title}</h1>
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
        <div className="flex gap-2 flex-wrap">
          <input
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder={`הוסף ${axis}`}
            value={newRowName}
            onChange={(e) => setNewRowName(e.target.value)}
          />
          <Button size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            הוסף {axis}
          </Button>
        </div>
      )}

      {!columns.length && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
          אין סעיפי כתב כמויות בפרויקט. הוסיפו סעיפים במסך כתבי כמויות ואז צרו דף חדש.
        </p>
      )}

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white max-h-[70vh]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap border-b">
                {axis}
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
                  {row.name}
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
              <td className="px-3 py-2">סה״כ</td>
              {columns.map((col) => {
                const sum = (sheet.rows ?? []).reduce((s: number, row: any) => {
                  const key = `${row.id}:${col.id}`;
                  return s + (Number(draft[key]) || 0);
                }, 0);
                return (
                  <td key={col.id} className="px-2 py-2 text-center">
                    {formatNumber(sum)}
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
