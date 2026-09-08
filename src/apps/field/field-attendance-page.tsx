"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fieldService,
  type FieldAttendanceStatus,
} from "@/features/field/services/field.service";
import { detectDeviceMeta } from "@/lib/attendance/device-client";
import { readGps } from "@/lib/attendance/gps-client";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";
import type { FieldAttendanceHistoryEntry } from "@/types";

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL");
}

function workDuration(checkedInAt?: string | null, checkedOutAt?: string | null) {
  if (!checkedInAt) return "—";
  const start = new Date(checkedInAt).getTime();
  const end = checkedOutAt ? new Date(checkedOutAt).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} דק׳`;
  return `${h} שע׳ ${m} דק׳`;
}

/** Self attendance only — GPS required */
export function FieldAttendancePage() {
  const [data, setData] = useState<FieldAttendanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<FieldAttendanceHistoryEntry[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [dashboard, attendanceHistory] = await Promise.all([
        fieldService.getAttendanceState(),
        fieldService.getAttendanceHistory({ period: "month" }),
      ]);
      setData(dashboard);
      setHistory(attendanceHistory.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  useEffect(() => {
    if (!data?.checkedIn) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [data?.checkedIn]);

  async function toggleAttendance() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const gps = await readGps();
      const device = detectDeviceMeta();
      const meta = {
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracy,
        deviceLabel: `${device.deviceType} · ${device.osName}`,
        userAgent: device.userAgent,
      };
      if (data.checkedIn) await fieldService.checkOut(meta);
      else await fieldService.checkIn(meta);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  const shownAttendance = data?.attendance || data?.todayAttendance;
  const duration = useMemo(
    () =>
      workDuration(
        shownAttendance?.checkedInAt,
        shownAttendance?.checkedOutAt
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shownAttendance?.checkedInAt,
      shownAttendance?.checkedOutAt,
      data?.checkedIn,
      tick,
    ]
  );

  if (!data) {
    return (
      <p className="py-16 text-center text-lg text-[#6B7280]">
        {error || "טוען…"}
      </p>
    );
  }

  const checkedIn = data.checkedIn;
  const completed = Boolean(shownAttendance?.checkedOutAt);
  const previousEntries = history.filter(
    (entry) => entry.id !== shownAttendance?.id
  );

  return (
    <div className="space-y-5">
      <section>
        <h1 className={field.title}>נוכחות</h1>
        <p className={field.subtitle}>היום שלי · היסטוריית נוכחות</p>
      </section>

      {error && <p className={field.error}>{error}</p>}

      <section className={cn(field.card, "overflow-hidden p-0")}>
        <div
          className={cn(
            "h-1.5 w-full",
            checkedIn ? "bg-emerald-500" : "bg-gray-300"
          )}
        />
        <div className="p-5">
          <p className="mt-1 text-[28px] font-black text-[#111827]">
            {checkedIn
              ? "✓ בעבודה עכשיו"
              : completed
                ? "✓ יום העבודה הסתיים"
                : "טרם בוצעה כניסה"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            תאריך:{" "}
            {fmtDate(shownAttendance?.checkedInAt || new Date().toISOString())}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#F7F8FA] px-3 py-3">
              <p className="text-sm text-[#6B7280]">כניסה</p>
              <p className="mt-1 text-lg font-black">
                {fmtTime(shownAttendance?.checkedInAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F8FA] px-3 py-3">
              <p className="text-sm text-[#6B7280]">יציאה</p>
              <p className="mt-1 text-lg font-black">
                {fmtTime(shownAttendance?.checkedOutAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F8FA] px-3 py-3">
              <p className="text-sm text-[#6B7280]">זמן</p>
              <p className="mt-1 text-lg font-black">{duration}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleAttendance()}
            className={cn(
              "mt-5",
              checkedIn ? field.btnDanger : field.btnSuccess,
              "min-h-16 text-xl"
            )}
          >
            {busy
              ? "מאמת GPS…"
              : checkedIn
                ? "יציאה מהעבודה"
                : "כניסה לעבודה"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-black text-slate-950">היסטוריית נוכחות</h2>
        <div className="mt-3 space-y-2">
          {previousEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">{entry.date}</p>
                <p className="shrink-0 text-sm font-bold text-slate-700">
                  {entry.hours.toFixed(2)} שעות
                </p>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {entry.checkIn || "—"} כניסה · {entry.checkOut || "פתוח"} יציאה
              </p>
            </article>
          ))}
          {!previousEntries.length && (
            <p className="py-5 text-center text-sm text-slate-400">
              אין רישומים קודמים החודש
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
