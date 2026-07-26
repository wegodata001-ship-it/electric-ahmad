"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckSquare, ClipboardList, Package } from "lucide-react";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function FieldHome() {
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
      if (data.checkedIn) await fieldService.checkOut();
      else await fieldService.checkIn();
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

  const firstName = data.foreman.name.split(" ")[0] || data.foreman.name;
  const checkedIn = data.checkedIn;

  return (
    <div className="space-y-6">
      <section>
        <h1 className={field.title}>שלום, {firstName}</h1>
        <p className={field.subtitle}>מנהל עבודה</p>
      </section>

      {error && <p className={field.error}>{error}</p>}

      {/* Attendance — no red full-card border */}
      <section className={cn(field.card, "overflow-hidden p-0")}>
        <div
          className={cn(
            "h-1.5 w-full",
            checkedIn ? "bg-emerald-500" : "bg-gray-300"
          )}
        />
        <div className="p-5">
          <p className="text-base font-bold text-[#6B7280]">נוכחות</p>
          <p className="mt-2 text-[28px] font-black text-[#111827]">
            {checkedIn ? "🟢 בעבודה" : "⚪ לא בעבודה"}
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
            {busy ? "…" : checkedIn ? "יציאה מהעבודה" : "כניסה לעבודה"}
          </button>
        </div>
      </section>

      <nav className="grid gap-4">
        <HomeCard
          href="/field/work-orders"
          icon={ClipboardList}
          title="סידורי עבודה"
          subtitle="מה קיבלת ממנהל התפעול"
          accent="blue"
        />
        <HomeCard
          href="/field/work-diaries/new"
          icon={BookOpen}
          title="יצירת יומן עבודה"
          subtitle="מילוי בשטח · טיוטה או שליחה לאישור"
          accent="green"
        />
        <HomeCard
          href="/field/delivery-notes/new"
          icon={Package}
          title="יצירת תעודת משלוח"
          subtitle="פריטים · רכב · טיוטה או שליחה לאישור"
          accent="blue"
        />
        <HomeCard
          href="/field/approvals"
          icon={CheckSquare}
          title="אישורים"
          subtitle="אושר · ממתין · הוחזר לתיקון"
          accent="green"
        />
      </nav>
    </div>
  );
}

function HomeCard({
  href,
  icon: Icon,
  title,
  subtitle,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  accent: "blue" | "green";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[6.5rem] items-center gap-4 rounded-3xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-sm active:bg-gray-50"
    >
      <span
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl",
          accent === "blue"
            ? "bg-blue-50 text-blue-600"
            : "bg-emerald-50 text-emerald-600"
        )}
      >
        <Icon className="h-8 w-8" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-black text-[#111827]">{title}</span>
        <span className="mt-1 block text-base text-[#6B7280]">{subtitle}</span>
      </span>
    </Link>
  );
}
