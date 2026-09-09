"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock3,
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
      <section className="border-r-4 border-[#07875F] pr-3">
        <h1 className="text-2xl font-black text-[#0F172A]">
          שלום, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          עבודה בטוחה · דיווח ושליחה לאישור
        </p>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#DCE5EF] bg-white shadow-[0_3px_10px_rgba(15,23,42,0.05)]">
        <div
          className={cn(
            "h-1.5",
            attendanceState?.checkedIn || completed
              ? "bg-[#059669]"
              : "bg-[#E2E8F0]"
          )}
        />
        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ECFDF5] text-[#059669]">
              <Clock3 className="h-5 w-5" />
            </span>
            <p className="text-xs font-bold text-[#64748B]">נוכחות היום</p>
          </div>
          {!attendanceState ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              בודק מצב נוכחות…
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "mt-3 text-xl font-black",
                  attendanceState.checkedIn || completed
                    ? "text-[#047857]"
                    : "text-[#0F172A]"
                )}
              >
                {attendanceState.checkedIn
                  ? "כעת בוצעה כניסה"
                  : completed
                    ? "יום העבודה הסתיים"
                    : "טרם בוצעה כניסה"}
              </p>
              {today && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#334155]">
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
                    ? "bg-[#DC4C4C] hover:bg-[#C83F3F]"
                    : "bg-[#07875F] hover:bg-[#066B4C]"
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
          iconClassName="bg-[#EFF6FF] text-[#2563EB]"
        />
        <HomeBtn
          href="/field/delivery-notes"
          icon={Truck}
          title="תעודת משלוח"
          description="יצירה וצפייה בתעודות משלוח"
          iconClassName="bg-[#FFF7ED] text-[#D97706]"
        />
        <HomeBtn
          href="/field/profile"
          icon={UserRound}
          title="פרופיל"
          description="מסמכים ופרטים אישיים"
          iconClassName="bg-[#F5F3FF] text-[#7C3AED]"
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
  iconClassName,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconClassName: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.25rem] items-center gap-3 rounded-[18px] border border-[#DCE4EE] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:scale-[0.99]"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-black text-[#0F172A]">{title}</span>
        <span className="mt-0.5 block text-xs text-[#64748B]">
          {description}
        </span>
      </span>
    </Link>
  );
}
