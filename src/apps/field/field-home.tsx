"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClockArrowDown,
  ClockArrowUp,
  Loader2,
  Truck,
  UserRound,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";
import {
  fieldService,
  type FieldAttendanceStatus,
} from "@/features/field/services/field.service";
import { detectDeviceMeta } from "@/lib/attendance/device-client";
import { readGps } from "@/lib/attendance/gps-client";

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Site Manager home — server-backed attendance action + core field actions.
 */
export function FieldHome() {
  const { userName } = usePortalSession("field");
  const firstName = (userName || "מנהל").split(" ")[0];
  const [attendanceState, setAttendanceState] =
    useState<FieldAttendanceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const next = await fieldService.getAttendanceState();
    setAttendanceState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "שגיאה בטעינת הנוכחות"
        );
      }
    })();
  }, [reload]);

  async function toggleAttendance() {
    if (!attendanceState || busy) return;
    setBusy(true);
    setError("");
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
      if (attendanceState.checkedIn) {
        await fieldService.checkOut(meta);
      } else {
        await fieldService.checkIn(meta);
      }
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "דיווח הנוכחות נכשל");
      await reload().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const open = attendanceState?.attendance;
  const today = open || attendanceState?.todayAttendance;
  const completed = Boolean(today?.checkedOutAt);

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-black text-slate-950">
          שלום, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          עבודה בטוחה · דיווח ושליחה לאישור
        </p>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div
          className={cn(
            "h-1.5",
            attendanceState?.checkedIn
              ? "bg-amber-500"
              : completed
                ? "bg-emerald-500"
                : "bg-slate-200"
          )}
        />
        <div className="p-5">
          <p className="text-xs font-bold text-slate-500">נוכחות היום</p>
          {!attendanceState ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              בודק מצב נוכחות…
            </div>
          ) : (
            <>
              <p className="mt-2 text-xl font-black text-slate-950">
                {attendanceState.checkedIn
                  ? "✓ בעבודה עכשיו"
                  : completed
                    ? "✓ יום העבודה הסתיים"
                    : "טרם בוצעה כניסה"}
              </p>
              {today && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>כניסה: {fmtTime(today.checkedInAt)}</span>
                  {today.checkedOutAt && (
                    <span>יציאה: {fmtTime(today.checkedOutAt)}</span>
                  )}
                  {completed && today.hours != null && (
                    <span>סה״כ: {today.hours.toFixed(2)} שעות</span>
                  )}
                </div>
              )}
              {error && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleAttendance()}
                className={cn(
                  "mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black text-white transition active:scale-[0.99] disabled:opacity-60",
                  attendanceState.checkedIn
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : attendanceState.checkedIn ? (
                  <ClockArrowDown className="h-5 w-5" />
                ) : (
                  <ClockArrowUp className="h-5 w-5" />
                )}
                {busy
                  ? "מאמת GPS…"
                  : attendanceState.checkedIn
                    ? "יציאה מהעבודה"
                    : "כניסה לעבודה"}
              </button>
            </>
          )}
        </div>
      </section>

      <nav className="grid gap-2.5">
        <HomeBtn
          href="/field/work-diaries"
          icon={BookOpen}
          title="יומן עבודה"
          description="דיווח וניהול יומני עבודה"
        />
        <HomeBtn
          href="/field/delivery-notes"
          icon={Truck}
          title="תעודת משלוח"
          description="יצירה וצפייה בתעודות משלוח"
        />
        <HomeBtn
          href="/field/profile"
          icon={UserRound}
          title="פרופיל"
          description="מסמכים ופרטים אישיים"
        />
      </nav>
    </div>
  );
}

function HomeBtn({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-black text-slate-950">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {description}
        </span>
      </span>
    </Link>
  );
}
