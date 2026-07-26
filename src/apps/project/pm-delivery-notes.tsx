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
  noteDate: string;
  clientName: string | null;
  project?: { id: string; name: string } | null;
  foreman?: { id: string; name: string } | null;
};

const STATUS: Record<string, string> = {
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  approved: "מאושר",
  sent_to_client: "נשלח למקבל",
  signed: "נמסר / נחתם",
  closed: "ארכיון",
  revision: "דורש תיקון",
};

const inputCls =
  "w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-base";

function bucket(status: string) {
  if (status === "draft" || status === "revision") return "draft";
  if (status === "pending_approval") return "pending";
  if (status === "signed" || status === "closed" || status === "approved")
    return "delivered";
  return "other";
}

export function PmDeliveryNotesList() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ items: Item[] }>("/api/ops-delivery-notes")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);

  const counts = useMemo(() => {
    const c = { draft: 0, pending: 0, delivered: 0 };
    for (const i of items) {
      const b = bucket(i.status);
      if (b === "draft") c.draft++;
      else if (b === "pending") c.pending++;
      else if (b === "delivered") c.delivered++;
    }
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">תעודות משלוח</h2>
          <p className="mt-1 text-sm text-slate-500">
            מסמך רשמי נפרד · אישורים · חתימת מקבל
          </p>
        </div>
        <Link
          href="/project/delivery-notes/new"
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
          <p className="text-slate-500">ממתינות</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white py-3">
          <p className="text-lg font-black text-emerald-700">{counts.delivered}</p>
          <p className="text-slate-500">נמסרו</p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-blue-200 bg-white py-12 text-center text-slate-400">
          אין תעודות — צור תעודה חדשה
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
                <p className="font-black">{item.documentNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.clientName || "לקוח"} ·{" "}
                  {new Date(item.noteDate).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                {STATUS[item.status] || item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {item.project?.name || "ללא פרויקט"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PmCreateDeliveryNote() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [foremen, setForemen] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [noteDate, setNoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(true);
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
      const items = itemsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [description, qty, unit] = line.split("|").map((s) => s.trim());
          return {
            description: description || line,
            quantity: Number(qty) || 1,
            unit: unit || "יח'",
          };
        });
      if (!items.length) throw new Error("יש להוסיף לפחות פריט אחד");

      const note = await apiClient.post<{ id: string }>("/api/ops-delivery-notes", {
        projectId: projectId || undefined,
        foremanId,
        noteDate,
        clientName,
        address: address || undefined,
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        notes: notes || undefined,
        items,
      });

      if (sendNow) {
        const approvers = await apiClient.get<{
          items: { id: string; name: string; roleLabel: string }[];
        }>("/api/approvals/approvers");
        const approverIds = pickDefaultApproverIds(approvers.items);
        if (!approverIds.length) {
          throw new Error("לא נמצאו מאשרים — התעודה נשמרה כטיוטה");
        }
        await apiClient.post(`/api/ops-delivery-notes/${note.id}/submit`, {
          approverIds,
        });
      }

      router.replace("/project/delivery-notes");
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
        <h2 className="text-2xl font-black">תעודת משלוח חדשה</h2>
        <p className="mt-1 text-sm text-slate-500">
          פריטים · רכב · נהג · שליחה לאישור
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
          className={inputCls}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">ללא / בחרו</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">מוסר / מנהל עבודה</span>
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
          value={noteDate}
          onChange={(e) => setNoteDate(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">לקוח</span>
        <input
          required
          className={inputCls}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">כתובת</span>
        <input
          className={inputCls}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">רכב</span>
          <input
            className={inputCls}
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">נהג</span>
          <input
            className={inputCls}
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">
          פריטים (שורה: תיאור | כמות | יחידה)
        </span>
        <textarea
          required
          className={inputCls}
          rows={4}
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          placeholder={"כבל 3×2.5 | 50 | מ'\nשקע כח | 12 | יח'"}
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
        href="/project/delivery-notes"
        className="block text-center text-sm font-bold text-blue-700"
      >
        ביטול
      </Link>
    </form>
  );
}
