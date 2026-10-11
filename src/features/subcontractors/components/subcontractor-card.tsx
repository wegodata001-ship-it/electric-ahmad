"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { ENGAGEMENT_LABELS } from "@/lib/subcontractors/constants";

type Card = {
  id: string;
  code: string;
  companyName: string;
  taxId: string | null;
  contactName: string;
  phone: string;
  email: string;
  address: string | null;
  specialty: string | null;
  status: string;
  bankDetails: string | null;
  paymentTerms: string | null;
  users: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    status: string;
    lastLoginAt: string | null;
  }>;
  assignments: Array<{
    id: string;
    projectId: string;
    projectName: string;
    description: string;
    engagementType: string;
    engagementLabel: string;
    status: string;
  }>;
  ledger: {
    totals: {
      engagement: number;
      reported: number;
      approved: number;
      submitted: number;
      approvedAccounts: number;
      paid: number;
      approvedPayable: number;
    };
    entries: Array<{
      id: string;
      type: string;
      amount: number;
      date: string;
      reference: string | null;
      projectName: string | null;
      actorName: string | null;
      notes: string | null;
    }>;
  };
  measurements: Array<{
    id: string;
    status: string;
    statusLabel: string;
    projectName: string;
    reportedTotal: number;
    approvedTotal: number;
  }>;
  accounts: Array<{
    id: string;
    status: string;
    statusLabel: string;
    projectName: string;
    payable: number;
    remaining: number;
  }>;
};

export function SubcontractorCard({ id }: { id: string }) {
  const [data, setData] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState({ email: "", contactName: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assign, setAssign] = useState({
    projectId: "",
    description: "",
    engagementType: "mixed",
    amount: "",
  });
  const [rate, setRate] = useState({
    assignmentId: "",
    description: "",
    unit: "יחידה",
    unitPrice: "",
  });
  const [pay, setPay] = useState({
    accountId: "",
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "transfer",
    reference: "",
  });

  async function load() {
    setError("");
    try {
      const card = await apiClient.get<Card>(`/api/subcontractors/${id}`);
      setData(card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    }
  }

  useEffect(() => {
    void load();
    apiClient
      .get<Array<{ id: string; name: string }> | { items?: Array<{ id: string; name: string }> }>(
        "/api/projects"
      )
      .then((r) => setProjects(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) {
    return <p className="text-sm text-slate-500">{error || "טוען…"}</p>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <p className="font-mono text-xs text-slate-400">{data.code}</p>
        <h1 className="text-2xl font-black">{data.companyName}</h1>
        <p className="text-sm text-slate-500">
          {data.contactName} · {data.phone} · {data.email}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section id="access" className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">גישת משתמשים</h2>
        {data.users.map((u) => (
          <div key={u.id} className="mb-2 flex items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-xs text-slate-500">
                {u.email} · כניסה אחרונה: {u.lastLoginAt ? u.lastLoginAt.slice(0, 16) : "טרם"}
              </p>
            </div>
            <button
              className="text-xs font-bold text-red-700"
              onClick={() =>
                apiClient
                  .post(`/api/subcontractors/${id}/access`, {
                    action: u.status === "active" ? "disable" : "enable",
                    membershipId: u.id,
                  })
                  .then(() => load())
                  .catch((e) => setError(e.message))
              }
            >
              {u.status === "active" ? "השבת גישה" : "הפעל גישה"}
            </button>
          </div>
        ))}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="שם איש קשר"
            value={invite.contactName}
            onChange={(e) => setInvite((p) => ({ ...p, contactName: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="אימייל"
            value={invite.email}
            onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <Button
          className="mt-2"
          onClick={() =>
            apiClient
              .post<{ activationUrl: string }>(`/api/subcontractors/${id}/access`, invite)
              .then((r) => {
                setInviteUrl(r.activationUrl);
                void load();
              })
              .catch((e) => setError(e.message))
          }
        >
          פתח גישה למערכת
        </Button>
        {inviteUrl && (
          <p className="mt-2 break-all rounded-xl bg-amber-50 p-2 text-xs">
            קישור חד-פעמי להפעלת חשבון (לא נשמר סיסמה): {inviteUrl}
          </p>
        )}
      </section>

      <section id="assign" className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">הקצאה לפרויקט</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={assign.projectId}
            onChange={(e) => setAssign((p) => ({ ...p, projectId: e.target.value }))}
          >
            <option value="">בחירת פרויקט</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="תיאור עבודה"
            value={assign.description}
            onChange={(e) => setAssign((p) => ({ ...p, description: e.target.value }))}
          />
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={assign.engagementType}
            onChange={(e) => setAssign((p) => ({ ...p, engagementType: e.target.value }))}
          >
            {Object.entries(ENGAGEMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="סכום קבוע (אופציונלי)"
            value={assign.amount}
            onChange={(e) => setAssign((p) => ({ ...p, amount: e.target.value }))}
          />
        </div>
        <Button
          className="mt-2"
          onClick={() =>
            apiClient
              .post(`/api/subcontractors/${id}/assignments`, {
                ...assign,
                amount: assign.amount ? Number(assign.amount) : null,
              })
              .then(() => load())
              .catch((e) => setError(e.message))
          }
        >
          + הקצה קבלן משנה
        </Button>
        <div className="mt-3 space-y-2">
          {data.assignments.map((a) => (
            <div key={a.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <p className="font-semibold">{a.projectName}</p>
              <p className="text-xs text-slate-500">
                {a.description} · {a.engagementLabel}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">מחירון קבלן (לא מחירי לקוח)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={rate.assignmentId}
            onChange={(e) => setRate((p) => ({ ...p, assignmentId: e.target.value }))}
          >
            <option value="">מחירון כללי לקבלן</option>
            {data.assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.projectName}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="עבודה"
            value={rate.description}
            onChange={(e) => setRate((p) => ({ ...p, description: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="יחידה"
            value={rate.unit}
            onChange={(e) => setRate((p) => ({ ...p, unit: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="מחיר"
            value={rate.unitPrice}
            onChange={(e) => setRate((p) => ({ ...p, unitPrice: e.target.value }))}
          />
        </div>
        <Button
          className="mt-2"
          onClick={() =>
            apiClient
              .post(`/api/subcontractors/${id}/rates`, {
                assignmentId: rate.assignmentId || null,
                items: [
                  {
                    description: rate.description,
                    unit: rate.unit,
                    unitPrice: Number(rate.unitPrice),
                  },
                ],
              })
              .then(() => load())
              .catch((e) => setError(e.message))
          }
        >
          הוסף סעיף מחירון
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">מדידות וחשבונות</h2>
        {data.measurements.map((m) => (
          <div key={m.id} className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <div>
              {m.projectName} · {m.statusLabel} · {m.reportedTotal} / {m.approvedTotal} ₪
            </div>
            {m.status === "submitted" && (
              <button
                className="text-xs font-bold"
                onClick={() =>
                  apiClient
                    .patch(`/api/subcontractor-measurements/${m.id}`, { action: "approve" })
                    .then(() => load())
                    .catch((e) => setError(e.message))
                }
              >
                אשר מדידה
              </button>
            )}
          </div>
        ))}
        {data.accounts.map((a) => (
          <div key={a.id} className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <div>
              {a.projectName} · {a.statusLabel} · יתרה {a.remaining} ₪
            </div>
            {["submitted", "pm_review"].includes(a.status) && (
              <button
                className="text-xs font-bold"
                onClick={() =>
                  apiClient
                    .patch(`/api/subcontractor-accounts/${a.id}`, { action: "approve" })
                    .then(() => load())
                    .catch((e) => setError(e.message))
                }
              >
                אשר חשבון
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">רישום תשלום</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={pay.accountId}
            onChange={(e) => setPay((p) => ({ ...p, accountId: e.target.value }))}
          >
            <option value="">ללא חשבון משויך</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.projectName} · {a.remaining} ₪
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="סכום"
            value={pay.amount}
            onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
          />
          <input
            type="date"
            className="rounded-xl border px-3 py-2 text-sm"
            value={pay.paidAt}
            onChange={(e) => setPay((p) => ({ ...p, paidAt: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="אסמכתה"
            value={pay.reference}
            onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))}
          />
        </div>
        <Button
          className="mt-2"
          onClick={() =>
            apiClient
              .post(`/api/subcontractors/${id}/payments`, {
                ...pay,
                amount: Number(pay.amount),
              })
              .then(() => load())
              .catch((e) => setError(e.message))
          }
        >
          רשום תשלום
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">כרטסת</h2>
          <a
            className="text-xs font-bold text-slate-600"
            href={`/api/subcontractors/${id}/ledger?format=csv`}
          >
            ייצוא Excel/CSV
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="התקשרויות" value={data.ledger.totals.engagement} />
          <Stat label="מדווח" value={data.ledger.totals.reported} />
          <Stat label="מאושר" value={data.ledger.totals.approved} />
          <Stat label="יתרה מאושרת" value={data.ledger.totals.approvedPayable} />
        </div>
        <div className="mt-3 space-y-1 text-xs">
          {data.ledger.entries.map((e) => (
            <div key={e.id} className="flex justify-between border-b py-1">
              <span>
                {e.date.slice(0, 10)} · {e.type} · {e.projectName || ""} {e.actorName ? `· ${e.actorName}` : ""}
              </span>
              <span className="font-bold">{e.amount.toLocaleString("he-IL")} ₪</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-black">{value.toLocaleString("he-IL")} ₪</p>
    </div>
  );
}
