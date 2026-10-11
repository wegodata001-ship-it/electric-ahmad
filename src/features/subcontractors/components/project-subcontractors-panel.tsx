"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ENGAGEMENT_LABELS } from "@/lib/subcontractors/constants";

type Assignment = {
  id: string;
  subcontractorId: string;
  companyName: string;
  description: string;
  engagementLabel: string;
  status: string;
  workSiteName: string | null;
  amount: number;
};

export function ProjectSubcontractorsPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState({
    contractorCount: 0,
    activeContractors: 0,
    openWorks: 0,
    pendingMeasurements: 0,
    pendingAccounts: 0,
  });
  const [contractors, setContractors] = useState<Array<{ id: string; companyName: string }>>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    subcontractorId: "",
    description: "",
    engagementType: "mixed",
    amount: "",
  });

  async function load() {
    try {
      const data = await apiClient.get<{ items: Assignment[]; summary: typeof summary }>(
        `/api/projects/${projectId}/subcontractors`
      );
      setItems(data.items);
      setSummary(data.summary);
      const list = await apiClient.get<{ items: Array<{ id: string; companyName: string }> }>(
        "/api/subcontractors"
      );
      setContractors(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function assign() {
    setError("");
    try {
      await apiClient.post(`/api/projects/${projectId}/subcontractors`, {
        ...form,
        amount: form.amount ? Number(form.amount) : null,
      });
      setForm({ subcontractorId: "", description: "", engagementType: "mixed", amount: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בהקצאה");
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="קבלנים" value={summary.contractorCount} />
        <Stat label="פעילים" value={summary.activeContractors} />
        <Stat label="עבודות פתוחות" value={summary.openWorks} />
        <Stat label="מדידות ממתינות" value={summary.pendingMeasurements} />
        <Stat label="חשבונות ממתינים" value={summary.pendingAccounts} />
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-bold">+ הקצה קבלן משנה</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={form.subcontractorId}
            onChange={(e) => setForm((p) => ({ ...p, subcontractorId: e.target.value }))}
          >
            <option value="">בחירת קבלן</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="תיאור עבודה"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={form.engagementType}
            onChange={(e) => setForm((p) => ({ ...p, engagementType: e.target.value }))}
          >
            {Object.entries(ENGAGEMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="סכום / מחירון (אופציונלי)"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          onClick={() => void assign()}
        >
          הקצה
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold">{item.companyName}</p>
            <p className="text-xs text-slate-500">
              {item.description} · {item.engagementLabel}
              {item.workSiteName ? ` · ${item.workSiteName}` : ""}
            </p>
          </div>
        ))}
        {!items.length && <p className="text-sm text-slate-500">אין קבלני משנה משויכים לפרויקט</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
