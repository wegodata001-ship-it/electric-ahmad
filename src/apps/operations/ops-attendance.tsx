"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { apiClient } from "@/lib/api/client";

type AttendanceState = {
  checkedIn: boolean;
  attendance: {
    id: string;
    checkedInAt: string;
    checkedOutAt: string | null;
  } | null;
};

export function OpsAttendance({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<AttendanceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    apiClient
      .get<AttendanceState>("/api/operations/attendance")
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggle() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.post<AttendanceState>(
        "/api/operations/attendance",
        { action: data.checkedIn ? "check_out" : "check_in" }
      );
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <p className="py-8 text-center text-stone-400">{error || "טוען…"}</p>
    );
  }

  const since =
    data.checkedIn && data.attendance
      ? new Date(data.attendance.checkedInAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <section
      className={
        compact
          ? "rounded-3xl border-2 border-amber-300 bg-white p-5 shadow-sm"
          : "space-y-4"
      }
    >
      {!compact && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Clock className="h-7 w-7 text-amber-700" />
            נוכחות
          </h1>
          <p className="mt-1 text-sm text-stone-500">לחיצה אחת — כניסה או יציאה</p>
        </div>
      )}

      {compact && (
        <p className="text-sm font-bold text-amber-800">🕒 נוכחות</p>
      )}

      <p className={compact ? "mt-2 text-xl font-black" : "text-xl font-black"}>
        {data.checkedIn ? `בעבודה מאז ${since}` : "לא בעבודה"}
      </p>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={
          data.checkedIn
            ? "mt-5 flex min-h-20 w-full items-center justify-center rounded-2xl bg-red-600 text-2xl font-black text-white disabled:opacity-60"
            : "mt-5 flex min-h-20 w-full items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white disabled:opacity-60"
        }
      >
        {busy ? "…" : data.checkedIn ? "יציאה מהעבודה" : "כניסה לעבודה"}
      </button>
    </section>
  );
}
