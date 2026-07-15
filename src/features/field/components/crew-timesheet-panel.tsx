"use client";

import { useCallback, useEffect, useState } from "react";
import { fieldService } from "@/features/field/services/field.service";
import type {
  FieldCrewHoursSummary,
  FieldCrewTimeEntry,
} from "@/types";
import { computeTotalHours } from "@/utils/work-hours";
import { Plus, Trash2 } from "lucide-react";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHours(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

type DraftRow = {
  key: string;
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  dirty?: boolean;
  saving?: boolean;
};

function toDraft(e: FieldCrewTimeEntry): DraftRow {
  return {
    key: e.id,
    id: e.id,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    notes: e.notes,
  };
}

export function CrewTimesheetPanel({
  crewMemberId,
  workerName,
}: {
  crewMemberId: string;
  workerName: string;
}) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [summary, setSummary] = useState<FieldCrewHoursSummary>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fieldService.getCrewTimeEntries(crewMemberId);
      setRows(data.entries.map(toDraft));
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת כרטסת שעות");
    } finally {
      setLoading(false);
    }
  }, [crewMemberId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function patchRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, ...patch, dirty: true } : r
      )
    );
  }

  async function saveRow(row: DraftRow) {
    if (!row.date) {
      setError("יש לבחור תאריך");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.key === row.key ? { ...r, saving: true } : r))
    );
    setError(null);
    try {
      if (row.id) {
        const res = await fieldService.updateCrewTimeEntry(row.id, {
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          notes: row.notes,
        });
        setSummary(res.summary);
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? { ...toDraft(res.entry), dirty: false, saving: false }
              : r
          )
        );
      } else {
        const res = await fieldService.createCrewTimeEntry(crewMemberId, {
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          notes: row.notes,
        });
        setSummary(res.summary);
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? { ...toDraft(res.entry), dirty: false, saving: false }
              : r
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
      setRows((prev) =>
        prev.map((r) => (r.key === row.key ? { ...r, saving: false } : r))
      );
    }
  }

  async function deleteRow(row: DraftRow) {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      return;
    }
    if (!window.confirm("למחוק את הרישום?")) return;
    setError(null);
    try {
      const res = await fieldService.deleteCrewTimeEntry(row.id);
      setSummary(res.summary);
      setRows((prev) => prev.filter((r) => r.key !== row.key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  function addDay() {
    setRows((prev) => [
      {
        key: `new-${Date.now()}`,
        date: todayISO(),
        startTime: "07:00",
        endTime: "16:00",
        notes: "",
        dirty: true,
      },
      ...prev,
    ]);
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">טוען כרטסת שעות...</p>
    );
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3 mt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-base font-bold text-gray-900">
          כרטסת שעות · {workerName}
        </p>
        <p className="text-xs text-gray-400">תיעוד ידני על ידי מנהל העבודה</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryChip label="שעות היום" value={summary.today} />
        <SummaryChip label="שעות השבוע" value={summary.week} />
        <SummaryChip label="שעות החודש" value={summary.month} />
        <SummaryChip label="סך כל השעות" value={summary.total} emphasize />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => {
          const hours = computeTotalHours(row.startTime, row.endTime);
          return (
            <div
              key={row.key}
              className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2"
            >
              <label className="block text-xs text-gray-500">
                תאריך
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => patchRow(row.key, { date: e.target.value })}
                  className="mt-1 w-full min-h-11 border border-gray-300 rounded-xl px-3 bg-white"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">
                  כניסה
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) =>
                      patchRow(row.key, { startTime: e.target.value })
                    }
                    className="mt-1 w-full min-h-11 border border-gray-300 rounded-xl px-3 bg-white"
                    dir="ltr"
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  יציאה
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) =>
                      patchRow(row.key, { endTime: e.target.value })
                    }
                    className="mt-1 w-full min-h-11 border border-gray-300 rounded-xl px-3 bg-white"
                    dir="ltr"
                  />
                </label>
              </div>
              <p className="text-sm font-semibold">
                שעות עבודה: {formatHours(hours)}
              </p>
              <label className="block text-xs text-gray-500">
                הערות
                <input
                  value={row.notes}
                  onChange={(e) => patchRow(row.key, { notes: e.target.value })}
                  className="mt-1 w-full min-h-11 border border-gray-300 rounded-xl px-3 bg-white"
                  placeholder="אופציונלי"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={row.saving || (!row.dirty && !!row.id)}
                  onClick={() => saveRow(row)}
                  className="flex-1 h-11 rounded-xl bg-[#1e40af] text-white font-semibold disabled:opacity-40"
                >
                  {row.saving ? "שומר..." : "שמור"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow(row)}
                  className="h-11 px-4 rounded-xl border border-red-200 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right px-3 py-2.5 font-medium">תאריך</th>
              <th className="text-right px-3 py-2.5 font-medium">כניסה</th>
              <th className="text-right px-3 py-2.5 font-medium">יציאה</th>
              <th className="text-right px-3 py-2.5 font-medium">שעות עבודה</th>
              <th className="text-right px-3 py-2.5 font-medium">הערות</th>
              <th className="text-right px-3 py-2.5 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hours = computeTotalHours(row.startTime, row.endTime);
              return (
                <tr key={row.key} className="border-t border-gray-100 bg-white">
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        patchRow(row.key, { date: e.target.value })
                      }
                      className="w-full min-h-10 border border-gray-200 rounded-lg px-2"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) =>
                        patchRow(row.key, { startTime: e.target.value })
                      }
                      className="w-full min-h-10 border border-gray-200 rounded-lg px-2"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) =>
                        patchRow(row.key, { endTime: e.target.value })
                      }
                      className="w-full min-h-10 border border-gray-200 rounded-lg px-2"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    {formatHours(hours)}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.notes}
                      onChange={(e) =>
                        patchRow(row.key, { notes: e.target.value })
                      }
                      className="w-full min-h-10 border border-gray-200 rounded-lg px-2"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={row.saving || (!row.dirty && !!row.id)}
                      onClick={() => saveRow(row)}
                      className="text-[#1e40af] font-semibold ml-3 disabled:opacity-40"
                    >
                      {row.saving ? "..." : "שמור"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      className="text-red-600 font-semibold"
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-gray-400 py-6 text-sm">
            אין רישומי שעות עדיין
          </p>
        )}
      </div>

      {rows.length === 0 && (
        <p className="lg:hidden text-center text-gray-400 py-2 text-sm">
          אין רישומי שעות עדיין
        </p>
      )}

      <button
        type="button"
        onClick={addDay}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border-2 border-dashed border-gray-300 text-gray-700 font-semibold hover:border-[#1e40af] hover:text-[#1e40af]"
      >
        <Plus className="h-4 w-4" />
        הוסף יום עבודה
      </button>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 border ${
        emphasize
          ? "bg-[#eff6ff] border-[#bfdbfe]"
          : "bg-white border-gray-200"
      }`}
    >
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-bold tabular-nums">{formatHours(value)}</p>
    </div>
  );
}
