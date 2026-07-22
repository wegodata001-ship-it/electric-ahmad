"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, Users } from "lucide-react";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";
import "@/features/work-management/styles/work-management.css";

export function FieldDashboardPage() {
  const router = useRouter();
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

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-white border border-red-100 p-5 text-red-600 text-lg">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-400 py-16 text-lg">טוען...</p>;
  }

  const checkInLabel =
    data.checkedIn && data.attendance
      ? new Date(data.attendance.checkedInAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="rounded-2xl bg-white border border-gray-200 p-5 lg:p-8">
        <p className="text-2xl lg:text-3xl font-bold text-gray-900">
          שלום, {data.foreman.name.split(" ")[0]}
        </p>
        <p className="text-base text-gray-500 mt-1">
          יומן עבודה, תעודות משלוח ועובדים — הכל במקום אחד
        </p>
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-1">
              סטטוס נוכחי
            </p>
            {data.checkedIn ? (
              <p className="text-lg font-bold text-[#1e40af]">
                🔵 בעבודה מאז {checkInLabel}
              </p>
            ) : (
              <p className="text-lg font-bold text-emerald-700">
                🟢 לא בעבודה
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              אופציונלי · אישי למנהל העבודה בלבד
            </p>
          </div>
          <Link
            href="/field/profile"
            className="text-sm font-semibold text-[#1e40af] underline-offset-2 hover:underline"
          >
            היסטוריית כניסות
          </Link>
        </div>
        <button
          type="button"
          onClick={toggleAttendance}
          disabled={busy}
          className={`w-full h-16 rounded-2xl text-lg font-bold disabled:opacity-50 ${
            data.checkedIn
              ? "border-2 border-gray-300 bg-white text-gray-800"
              : "bg-[#1e40af] text-white"
          }`}
        >
          {busy
            ? "מעדכן..."
            : data.checkedIn
              ? "יציאה מהעבודה"
              : "כניסה לעבודה"}
        </button>
      </section>

      <div className="wm-quick-tiles">
        <Link href="/field/work-diaries/new" className="wm-tile">
          <Plus className="h-5 w-5" />
          יומן עבודה חדש
        </Link>
        <Link href="/field/work-diaries" className="wm-tile">
          <BookOpen className="h-5 w-5" />
          יומן עבודה
        </Link>
        <Link href="/field/crew" className="wm-tile">
          <Users className="h-5 w-5" />
          העובדים שלי
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-2xl bg-white border border-gray-200 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-gray-400 mb-2">יומן עבודה</p>
          <p className="text-lg text-gray-800">
            צרו יומן עבודה, שבצו עובדים ושלחו לאישור
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/field/work-diaries/new")}
              disabled={data.projects.length === 0}
              className="h-14 rounded-2xl bg-[#03142F] text-white text-base font-bold disabled:opacity-50 px-6"
            >
              יומן חדש
            </button>
            <button
              type="button"
              onClick={() => router.push("/field/work-diaries")}
              className="h-14 rounded-2xl border border-gray-300 text-base font-semibold px-6"
            >
              כל היומנים
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-400">סיכום מהיר</p>
          <p className="text-base">
            <span className="font-bold text-2xl">{data.crewCount}</span>{" "}
            עובדים ברשימה שלי
          </p>
          <p className="text-base text-gray-600">
            {data.projects.length} פרויקטים בחברה
          </p>
          <button
            type="button"
            onClick={() => router.push("/field/crew")}
            className="w-full h-12 rounded-xl border border-gray-300 text-base font-semibold"
          >
            עובדים שלי
          </button>
        </section>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
