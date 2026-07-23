"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckSquare, ClipboardList, Package } from "lucide-react";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";

export function FieldHome() {
  const [data, setData] = useState<FieldDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState("");

  const reload = useCallback(() => {
    fieldService
      .getDashboard()
      .then((d) => {
        setData(d);
        if (d.projects.length === 1) setProjectId(d.projects[0]!.id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleAttendance() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      if (data.checkedIn) await fieldService.checkOut();
      else await fieldService.checkIn(projectId || undefined);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <p className="py-16 text-center text-white/50">
        {error || "טוען…"}
      </p>
    );
  }

  const firstName = data.foreman.name.split(" ")[0] || data.foreman.name;
  const since =
    data.checkedIn && data.attendance
      ? new Date(data.attendance.checkedInAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-3xl font-black tracking-tight">שלום {firstName}</h1>
        <p className="mt-1 text-sm text-white/50">אפליקציית שטח</p>
      </section>

      {error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Attendance — primary action */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white/50">נוכחות</p>
        <p className="mt-2 text-xl font-bold">
          {data.checkedIn ? `בעבודה מאז ${since}` : "לא בעבודה"}
        </p>

        {!data.checkedIn && data.projects.length > 1 && (
          <select
            className="mt-4 w-full rounded-2xl border border-white/15 bg-[#0b1220] px-4 py-3 text-base"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">בחר פרויקט (אופציונלי)</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleAttendance()}
          className={
            data.checkedIn
              ? "mt-5 flex min-h-16 w-full items-center justify-center rounded-2xl bg-red-600 text-xl font-black text-white disabled:opacity-60"
              : "mt-5 flex min-h-16 w-full items-center justify-center rounded-2xl bg-emerald-500 text-xl font-black text-[#052e16] disabled:opacity-60"
          }
        >
          {busy ? "…" : data.checkedIn ? "יציאה מהעבודה" : "כניסה לעבודה"}
        </button>
      </section>

      <nav className="grid grid-cols-1 gap-3">
        <HomeLink href="/field/work-orders" icon={ClipboardList} label="סידורי עבודה" />
        <HomeLink href="/field/work-diaries" icon={BookOpen} label="יומן עבודה" />
        <HomeLink href="/field/delivery-notes" icon={Package} label="תעודת משלוח" />
        <HomeLink href="/field/approvals" icon={CheckSquare} label="אישורים" />
      </nav>
    </div>
  );
}

function HomeLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 text-lg font-bold active:bg-white/10"
    >
      <Icon className="h-7 w-7 text-teal-300" />
      {label}
    </Link>
  );
}
