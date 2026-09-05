"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";
import { detectDeviceMeta } from "@/lib/attendance/device-client";
import { readGps } from "@/lib/attendance/gps-client";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

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
  const [data, setData] = useState<FieldDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const reload = useCallback(() => {
    fieldService
      .getDashboard()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }, []);

  useEffect(() => {
    reload();
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
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  const duration = useMemo(
    () =>
      workDuration(
        data?.attendance?.checkedInAt,
        data?.attendance?.checkedOutAt
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.attendance?.checkedInAt, data?.attendance?.checkedOutAt, data?.checkedIn]
  );

  if (!data) {
    return (
      <p className="py-16 text-center text-lg text-[#6B7280]">
        {error || "טוען…"}
      </p>
    );
  }

  const checkedIn = data.checkedIn;

  return (
    <div className="space-y-5">
      <section>
        <h1 className={field.title}>נוכחות</h1>
        <p className={field.subtitle}>דיווח לעצמך בלבד · נדרש GPS</p>
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
            {checkedIn ? "🟢 בעבודה" : "⚪ לא בעבודה"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            תאריך: {fmtDate(data.attendance?.checkedInAt) || fmtDate(new Date().toISOString())}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#F7F8FA] px-3 py-3">
              <p className="text-sm text-[#6B7280]">כניסה</p>
              <p className="mt-1 text-lg font-black">
                {fmtTime(data.attendance?.checkedInAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F8FA] px-3 py-3">
              <p className="text-sm text-[#6B7280]">יציאה</p>
              <p className="mt-1 text-lg font-black">
                {fmtTime(data.attendance?.checkedOutAt)}
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
    </div>
  );
}
