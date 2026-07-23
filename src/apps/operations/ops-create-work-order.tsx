"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";

type Project = { id: string; name: string };
type Foreman = { id: string; name: string };

const inputCls =
  "w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-base";

export function OpsCreateWorkOrder() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [projectId, setProjectId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState("");
  const [workersText, setWorkersText] = useState("");
  const [equipment, setEquipment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/foremen")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([proj, fm]) => {
      const pRaw = proj?.data ?? proj;
      const list = Array.isArray(pRaw)
        ? pRaw
        : Array.isArray(pRaw?.items)
          ? pRaw.items
          : [];
      setProjects(
        list.map((p: any) => ({ id: p.id, name: p.name || p.contractNumber }))
      );

      const fRaw = fm?.data ?? fm;
      const fList = Array.isArray(fRaw)
        ? fRaw
        : Array.isArray(fRaw?.items)
          ? fRaw.items
          : [];
      setForemen(
        fList.map((f: any) => ({
          id: f.id || f.employeeId,
          name:
            f.name ||
            `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() ||
            "מנהל עבודה",
        }))
      );
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const workers = workersText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      const vehicles = equipment
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      await apiClient.post("/api/work-orders", {
        projectId,
        foremanId,
        date,
        title: title || tasks.split("\n")[0] || "סידור עבודה",
        notes: [tasks && `משימות:\n${tasks}`, equipment && `ציוד:\n${equipment}`]
          .filter(Boolean)
          .join("\n\n"),
        status: "assigned",
        workers,
        vehicles,
      });
      router.replace("/operations");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-2xl font-black">יצירת סידור עבודה</h2>
        <p className="mt-1 text-sm text-stone-500">
          בחר · קבע · שלח. בלי מסכים מיותרים.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">פרויקט</span>
        <select
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inputCls}
        >
          <option value="">בחר פרויקט</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">מנהל עבודה</span>
        <select
          required
          value={foremanId}
          onChange={(e) => setForemanId(e.target.value)}
          className={inputCls}
        >
          <option value="">בחר מנהל עבודה</option>
          {foremen.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">תאריך</span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">כותרת (אופציונלי)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          placeholder="התקנת לוחות קומה 3"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">משימות</span>
        <textarea
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
          className={`${inputCls} min-h-28`}
          placeholder={"התקנת לוח\nמשיכת כבלים"}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">עובדים (שם בכל שורה)</span>
        <textarea
          value={workersText}
          onChange={(e) => setWorkersText(e.target.value)}
          className={`${inputCls} min-h-24`}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">ציוד</span>
        <textarea
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          className={`${inputCls} min-h-20`}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-amber-700 text-lg font-black text-white disabled:opacity-60"
      >
        {busy ? "שולח…" : "שלח לסידור"}
      </button>
    </form>
  );
}
