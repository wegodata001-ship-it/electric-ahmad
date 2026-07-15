"use client";

import { useCallback, useEffect, useState } from "react";
import { fieldService } from "@/features/field/services/field.service";
import type {
  FieldAttendanceHistoryEntry,
  FieldAttendancePersonalSummary,
} from "@/types";

type Period = "today" | "week" | "month" | "range";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "היום" },
  { id: "week", label: "השבוע" },
  { id: "month", label: "החודש" },
  { id: "range", label: "טווח תאריכים" },
];

function formatHours(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function FieldProfilePage() {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entries, setEntries] = useState<FieldAttendanceHistoryEntry[]>([]);
  const [summary, setSummary] =
    useState<FieldAttendancePersonalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (period === "range" && (!from || !to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fieldService
      .getAttendanceHistory({
        period,
        from: period === "range" ? from : undefined,
        to: period === "range" ? to : undefined,
      })
      .then((data) => {
        setEntries(data.entries);
        setSummary(data.summary);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [period, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">הפרופיל שלי</h1>
        <p className="text-base text-gray-500 mt-1">
          כניסות ויציאות אישיות של מנהל העבודה · לא קשור לכרטסת העובדים
        </p>
      </div>

      {summary && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-5">
          <p className="text-sm font-semibold text-gray-400 mb-3">
            סיכום אישי · החודש
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="ימי עבודה" value={String(summary.workDays)} />
            <Stat
              label="סך שעות החודש"
              value={formatHours(summary.monthHours)}
            />
            <Stat
              label="ממוצע שעות ליום"
              value={formatHours(summary.avgPerDay)}
            />
            <Stat
              label="כניסה אחרונה"
              value={
                summary.lastCheckIn
                  ? `${summary.lastCheckIn.date} ${summary.lastCheckIn.time}`
                  : "—"
              }
              small
            />
            <Stat
              label="יציאה אחרונה"
              value={
                summary.lastCheckOut
                  ? `${summary.lastCheckOut.date} ${summary.lastCheckOut.time}`
                  : "—"
              }
              small
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-5 space-y-4">
        <p className="text-lg font-bold">היסטוריית כניסות ויציאות</p>

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`h-11 px-4 rounded-xl text-sm font-semibold border ${
                period === p.id
                  ? "bg-[#1e40af] text-white border-[#1e40af]"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "range" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">
              מתאריך
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full min-h-12 border border-gray-300 rounded-xl px-3"
              />
            </label>
            <label className="text-xs text-gray-500">
              עד תאריך
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full min-h-12 border border-gray-300 rounded-xl px-3"
              />
            </label>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">טוען...</p>
        ) : (
          <>
            <div className="space-y-2 lg:hidden">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <p className="font-bold">{e.date}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    כניסה {e.checkIn || "—"} · יציאה {e.checkOut || "—"}
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    {formatHours(e.hours)} שעות
                    {!e.checkedOutAt && (
                      <span className="text-xs text-[#1e40af] mr-2">
                        (פתוח)
                      </span>
                    )}
                  </p>
                </div>
              ))}
              {entries.length === 0 && (
                <p className="text-center text-gray-400 py-6">
                  אין רישומים בתקופה שנבחרה
                </p>
              )}
            </div>

            <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-right px-4 py-3">תאריך</th>
                    <th className="text-right px-4 py-3">כניסה</th>
                    <th className="text-right px-4 py-3">יציאה</th>
                    <th className="text-right px-4 py-3">שעות</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">{e.date}</td>
                      <td className="px-4 py-3" dir="ltr">
                        {e.checkIn || "—"}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {e.checkOut || (
                          <span className="text-[#1e40af]">פתוח</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatHours(e.hours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entries.length === 0 && (
                <p className="text-center text-gray-400 py-8">
                  אין רישומים בתקופה שנבחרה
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={`font-bold text-gray-900 mt-0.5 ${
          small ? "text-sm" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
