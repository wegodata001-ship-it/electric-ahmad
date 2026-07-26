"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";

type Item = {
  id: string;
  orderNumber: string;
  date: string;
  title: string | null;
  status: string;
  address: string | null;
  workArea?: string | null;
  project?: { name: string; location?: string } | null;
  foreman?: { name: string } | null;
  workers?: { name: string }[];
};

const STATUS: Record<string, string> = {
  draft: "טיוטה",
  assigned: "מתוכנן",
  in_progress: "בביצוע",
  completed: "הסתיים",
  cancelled: "סגור",
};

const inputCls =
  "w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-base";

export function PmWorkOrdersList() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    apiClient
      .get<{
        items: Item[];
        statusCounts?: Record<string, number>;
      }>("/api/work-orders")
      .then((d) => {
        setItems(d.items);
        setCounts(d.statusCounts || {});
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">סידורי עבודה</h2>
          <p className="mt-1 text-sm text-slate-500">תכנון עבודה עתידית בשטח</p>
        </div>
        <Link
          href="/project/work-orders/new"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-blue-700 px-4 font-black text-white"
        >
          <Plus className="h-5 w-5" />
          חדש
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
        <Stat label="פתוחים" value={(counts.open ?? 0) || (counts.draft || 0) + (counts.planned || 0)} />
        <Stat label="בביצוע" value={counts.inProgress || 0} />
        <Stat label="הסתיימו" value={counts.done || 0} />
        <Stat label="סגורים" value={counts.closed || 0} />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-blue-200 bg-white py-12 text-center text-slate-400">
          אין סידורים — צור את הראשון
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl bg-white px-4 py-4 ring-1 ring-blue-100"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-slate-900">
                  {item.project?.name || "פרויקט"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.orderNumber} ·{" "}
                  {new Date(item.date).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                {STATUS[item.status] || item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {item.workArea ||
                item.address ||
                item.project?.location ||
                item.title ||
                "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              מנהל עבודה: {item.foreman?.name || "—"}
              {item.workers?.length
                ? ` · ${item.workers.length} עובדים`
                : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white px-2 py-3">
      <p className="text-lg font-black text-blue-800">{value}</p>
      <p className="text-slate-500">{label}</p>
    </div>
  );
}

export function PmCreateWorkOrder() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [foremen, setForemen] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [tasks, setTasks] = useState("");
  const [workersText, setWorkersText] = useState("");
  const [equipment, setEquipment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()).catch(() => null),
      fetch("/api/foremen").then((r) => r.json()).catch(() => null),
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
        workArea: workArea || undefined,
        notes: [tasks && `משימות:\n${tasks}`, equipment && `ציוד:\n${equipment}`]
          .filter(Boolean)
          .join("\n\n"),
        status: "assigned",
        workers,
        vehicles,
      });
      router.replace("/project/work-orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">סידור עבודה חדש</h2>
        <p className="mt-1 text-sm text-slate-500">
          הקצה מנהל עבודה · עובדים · ציוד · תאריך
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
          className={inputCls}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">בחרו פרויקט</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">מנהל עבודה אחראי</span>
        <select
          required
          className={inputCls}
          value={foremanId}
          onChange={(e) => setForemanId(e.target.value)}
        >
          <option value="">בחרו מנהל עבודה</option>
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
          className={inputCls}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">כותרת</span>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="סידור יומי"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">חדר / אזור</span>
        <input
          className={inputCls}
          value={workArea}
          onChange={(e) => setWorkArea(e.target.value)}
          placeholder="קומה 2 · חדר חשמל"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">משימות (שורה לכל משימה)</span>
        <textarea
          className={inputCls}
          rows={3}
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">עובדים (שורה לכל שם)</span>
        <textarea
          className={inputCls}
          rows={3}
          value={workersText}
          onChange={(e) => setWorkersText(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">ציוד / רכב (שורה לכל פריט)</span>
        <textarea
          className={inputCls}
          rows={2}
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-blue-700 py-4 text-base font-black text-white disabled:opacity-60"
      >
        {busy ? "שומר…" : "שמור כמתוכנן"}
      </button>
      <Link
        href="/project/work-orders"
        className="block text-center text-sm font-bold text-blue-700"
      >
        ביטול
      </Link>
    </form>
  );
}
