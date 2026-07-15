"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fieldService,
  type FieldDashboard,
} from "@/features/field/services/field.service";

export function FieldDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<FieldDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pickProject, setPickProject] = useState(false);
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

  async function openJournal(selectedProjectId?: string) {
    if (!data) return;
    if (data.openJournal) {
      router.push(`/field/journal/${data.openJournal.id}`);
      return;
    }

    const pid = selectedProjectId || projectId;
    if (!pid) {
      setPickProject(true);
      return;
    }

    setOpening(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const project = data.projects.find((p) => p.id === pid);
      const journal = await fieldService.createJournal({
        projectId: pid,
        date: today,
        clientName: project?.contractor,
        address: project?.location,
      });
      router.push(`/field/journal/${journal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בפתיחת יומן");
    } finally {
      setOpening(false);
      setPickProject(false);
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

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="rounded-2xl bg-white border border-gray-200 p-5 lg:p-8">
        <p className="text-2xl lg:text-3xl font-bold text-gray-900">
          שלום, {data.foreman.name.split(" ")[0]}
        </p>
        <p className="text-base text-gray-500 mt-1">
          דיווח יומי פשוט — בחר פרויקט, סמן עובדים, שלח למשרד
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-2xl bg-white border border-gray-200 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-gray-400 mb-2">
            יומן עבודה
          </p>
          <p className="text-lg text-gray-800">
            {data.openJournal
              ? `טיוטה פתוחה · ${data.openJournal.projectName} · ${data.openJournal.date}`
              : "אין יומן פתוח — פתח יומן חדש ובחר פרויקט"}
          </p>
          <button
            type="button"
            onClick={() => openJournal()}
            disabled={opening || data.projects.length === 0}
            className="mt-4 w-full lg:w-auto lg:min-w-[280px] h-16 rounded-2xl bg-[#1e40af] text-white text-lg font-bold disabled:opacity-50 px-8"
          >
            {opening
              ? "פותח..."
              : data.openJournal
                ? "המשך יומן עבודה"
                : "פתח יומן עבודה"}
          </button>
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

      {(pickProject || (!data.openJournal && data.projects.length > 1)) && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5">
          <p className="text-lg font-bold mb-3">בחר פרויקט להיום</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId(p.id);
                  openJournal(p.id);
                }}
                className={`text-right rounded-xl border px-4 py-4 ${
                  projectId === p.id
                    ? "border-[#1e40af] bg-[#eff6ff]"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="font-semibold text-base">{p.name}</p>
                <p className="text-sm text-gray-500 mt-1">{p.location}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <p className="text-sm text-gray-500 mb-3">
          כניסה / יציאה — אופציונלי, לא חובה
        </p>
        <button
          type="button"
          onClick={toggleAttendance}
          disabled={busy}
          className="w-full h-14 rounded-2xl border-2 border-gray-300 bg-white text-base font-semibold disabled:opacity-50"
        >
          {busy
            ? "מעדכן..."
            : data.checkedIn
              ? "יציאה מהעבודה"
              : "כניסה לעבודה"}
        </button>
        {data.checkedIn && data.attendance && (
          <p className="text-center text-sm text-gray-500 mt-2">
            נכנסת ב־
            {new Date(data.attendance.checkedInAt).toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
