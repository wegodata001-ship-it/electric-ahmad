"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { pickDefaultApproverIds } from "@/lib/approvers/default-approvers";

type Item = {
  id: string;
  documentNumber: string;
  status: string;
  statusLabel?: string;
  workDate: string;
  workSummary?: string | null;
  project?: { id: string; name: string } | null;
  foreman?: { id: string; name: string } | null;
};
type RawProject = {
  id: string;
  name?: string;
  contractNumber?: string;
  assigned?: boolean;
};
type RawForeman = {
  id?: string;
  employeeId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
};

const inputCls =
  "w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-base";

function bucket(status: string) {
  if (status === "draft" || status === "revision") return "draft";
  if (status === "pending_approval" || status === "in_approval") return "pending";
  if (
    status === "approved" ||
    status === "locked" ||
    status === "sent_to_client" ||
    status === "client_signed" ||
    status === "signed" ||
    status === "completed"
  )
    return "approved";
  return "other";
}

export function PmWorkDiariesList() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ items: Item[] }>("/api/work-diaries")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);

  const counts = useMemo(() => {
    const c = { draft: 0, pending: 0, approved: 0 };
    for (const i of items) {
      const b = bucket(i.status);
      if (b === "draft") c.draft++;
      else if (b === "pending") c.pending++;
      else if (b === "approved") c.approved++;
    }
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">יומן עבודה</h2>
          <p className="mt-1 text-sm text-slate-500">
            מסמך ביצוע רשמי · Workflow אישורים
          </p>
        </div>
        <Link
          href="/project/work-diaries/new"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-blue-700 px-4 font-black text-white"
        >
          <Plus className="h-5 w-5" />
          חדש
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <div className="rounded-2xl border border-blue-100 bg-white py-3">
          <p className="text-lg font-black text-blue-800">{counts.draft}</p>
          <p className="text-slate-500">טיוטות</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white py-3">
          <p className="text-lg font-black text-amber-700">{counts.pending}</p>
          <p className="text-slate-500">ממתינים</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white py-3">
          <p className="text-lg font-black text-emerald-700">{counts.approved}</p>
          <p className="text-slate-500">מאושרים</p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-blue-200 bg-white py-12 text-center text-slate-400">
          אין יומנים — צור יומן חדש
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/print/work-diaries/${item.id}`}
            className="block rounded-2xl bg-white px-4 py-4 ring-1 ring-blue-100"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black">{item.documentNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.project?.name || "פרויקט"} ·{" "}
                  {new Date(item.workDate).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                {item.statusLabel || item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">
              {item.workSummary || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              מנהל עבודה: {item.foreman?.name || "—"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PmCreateWorkDiary() {
  const router = useRouter();
  const [projects, setProjects] = useState<
    { id: string; name: string; assigned: boolean }[]
  >([]);
  const [foremen, setForemen] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [workDate, setWorkDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workType, setWorkType] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [workersText, setWorkersText] = useState("");
  const [equipmentText, setEquipmentText] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/document-creation-projects")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/foremen").then((r) => r.json()).catch(() => null),
    ]).then(([proj, fm]) => {
      const pRaw = proj?.data ?? proj;
      const list = Array.isArray(pRaw)
        ? pRaw
        : Array.isArray(pRaw?.projects)
          ? pRaw.projects
          : [];
      setProjects(
        list.map((p: RawProject) => ({
          id: p.id,
          name: p.name || p.contractNumber,
          assigned: Boolean(p.assigned),
        }))
      );
      const fRaw = fm?.data ?? fm;
      const fList = Array.isArray(fRaw)
        ? fRaw
        : Array.isArray(fRaw?.items)
          ? fRaw.items
          : [];
      setForemen(
        fList.map((f: RawForeman) => ({
          id: f.id || f.employeeId || "",
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
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      const equipment = equipmentText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      const materials = materialsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name) => ({ name, unit: "יח'", quantity: 1 }));

      const diary = await apiClient.post<{ id: string }>("/api/work-diaries", {
        projectId,
        foremanId,
        workDate,
        workType: workType || undefined,
        workSummary,
        notes: notes || undefined,
        workers,
        equipment,
        materials,
      });

      if (sendNow) {
        const approvers = await apiClient.get<{
          items: { id: string; name: string; roleLabel: string }[];
        }>("/api/approvals/approvers");
        const approverIds = pickDefaultApproverIds(approvers.items);
        if (!approverIds.length) {
          throw new Error("לא נמצאו מאשרים — היומן נשמר כטיוטה");
        }
        await apiClient.post(`/api/work-diaries/${diary.id}/submit`, {
          approverIds,
        });
      }

      router.replace("/project/work-diaries");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">יומן עבודה חדש</h2>
        <p className="mt-1 text-sm text-slate-500">
          תיעוד ביצוע · שליחה לאישור תפעול / הנהלה
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
          <optgroup label="הפרויקטים שלי">
            {projects
              .filter((p) => p.assigned)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="פרויקטים נוספים">
            {projects
              .filter((p) => !p.assigned)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">מנהל עבודה</span>
        <select
          required
          className={inputCls}
          value={foremanId}
          onChange={(e) => setForemanId(e.target.value)}
        >
          <option value="">בחרו</option>
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
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">סוג העבודה</span>
        <input
          className={inputCls}
          value={workType}
          onChange={(e) => setWorkType(e.target.value)}
          placeholder="חשמל · תאורה · לוחות"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">תיאור העבודה שבוצעה</span>
        <textarea
          required
          className={inputCls}
          rows={4}
          value={workSummary}
          onChange={(e) => setWorkSummary(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">עובדים (שורה לכל שם)</span>
        <textarea
          className={inputCls}
          rows={2}
          value={workersText}
          onChange={(e) => setWorkersText(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">ציוד / רכב</span>
        <textarea
          className={inputCls}
          rows={2}
          value={equipmentText}
          onChange={(e) => setEquipmentText(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">חומרים</span>
        <textarea
          className={inputCls}
          rows={2}
          value={materialsText}
          onChange={(e) => setMaterialsText(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">הערות</span>
        <textarea
          className={inputCls}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={sendNow}
          onChange={(e) => setSendNow(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-sm font-bold">שלח לאישור עכשיו</span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-blue-700 py-4 text-base font-black text-white disabled:opacity-60"
      >
        {busy ? "שומר…" : sendNow ? "שמור ושלח לאישור" : "שמור כטיוטה"}
      </button>
      <Link
        href="/project/work-diaries"
        className="block text-center text-sm font-bold text-blue-700"
      >
        ביטול
      </Link>
    </form>
  );
}
