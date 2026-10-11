"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import {
  ACCOUNT_STATUS_COLORS,
  EmptyState,
  ErrorState,
  FilterRow,
  KpiCard,
  PAYMENT_METHOD_LABELS,
  PortalCard,
  PortalPage,
  SkeletonGrid,
  StatusPill,
  moneyText,
} from "@/apps/subcontractor/portal-ui";

type Finance = {
  totals: {
    reported: number;
    approved: number;
    submitted: number;
    approvedAccounts: number;
    paid: number;
    approvedPayable: number;
    advances?: number;
    deductions?: number;
  };
  payments?: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: string;
    reference: string | null;
    accountId: string | null;
    projectName: string | null;
  }>;
};
type Accounts = {
  items: Array<{
    id: string;
    status: string;
    statusLabel: string;
    projectName: string;
    subtotal?: number;
    vatAmount?: number;
    payable: number;
    paid: number;
    remaining: number;
    createdAt: string;
  }>;
};
type Works = { assignments: Array<{ id: string; projectName: string; description: string; workStatus: string }> };

export default function Page() {
  return (
    <Suspense fallback={<SkeletonGrid count={6} />}>
      <FinanceScreen />
    </Suspense>
  );
}

function FinanceScreen() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"accounts" | "payments">(
    tabParam === "payments" ? "payments" : "accounts"
  );
  const [data, setData] = useState<Finance | null>(null);
  const [accounts, setAccounts] = useState<Accounts["items"]>([]);
  const [works, setWorks] = useState<Works | null>(null);
  const [assignmentId, setAssignmentId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [fin, acc, w] = await Promise.all([
        apiClient.get<Finance>("/api/subcontractor/finance"),
        apiClient.get<Accounts>("/api/subcontractor/accounts"),
        apiClient.get<Works>("/api/subcontractor/works"),
      ]);
      setData(fin);
      setAccounts(acc.items);
      setWorks(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "אין הרשאה או שגיאה בטעינה");
    }
  }

  useEffect(() => {
    let live = true;
    Promise.all([
      apiClient.get<Finance>("/api/subcontractor/finance"),
      apiClient.get<Accounts>("/api/subcontractor/accounts"),
      apiClient.get<Works>("/api/subcontractor/works"),
    ])
      .then(([fin, acc, w]) => {
        if (!live) return;
        setData(fin);
        setAccounts(acc.items);
        setWorks(w);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "אין הרשאה או שגיאה בטעינה");
      });
    return () => {
      live = false;
    };
  }, []);

  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <SkeletonGrid count={6} />;

  return (
    <PortalPage title="החשבונות שלי" subtitle="חשבונות ביצוע פנימיים ותשלומים שנרשמו לקבלן">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="סך ביצוע מדווח" value={moneyText(data.totals.reported)} hint="סכומי שורות מדידה מדווחות" />
        <KpiCard label="סך ביצוע מאושר" value={moneyText(data.totals.approved)} hint="כמויות מאושרות במדידות" />
        <KpiCard label="חשבונות שהוגשו" value={moneyText(data.totals.submitted)} />
        <KpiCard label="חשבונות שאושרו" value={moneyText(data.totals.approvedAccounts)} tone="success" />
        <KpiCard label="תשלומים שבוצעו" value={moneyText(data.totals.paid)} />
        <KpiCard
          label="יתרה לתשלום"
          value={moneyText(data.totals.approvedPayable)}
          hint="חשבונות מאושרים פחות כל התשלומים שנרשמו"
          tone="brand"
        />
      </div>
      <p className="text-xs text-[#5B6470]">
        היתרה אינה מחשבת מחדש מקדמות או קיזוזים בנפרד. אם הם נכללו בחשבון, הם כבר בתוך הסכום לתשלום של אותו חשבון.
      </p>

      <FilterRow
        value={tab}
        onChange={(id) => setTab(id as "accounts" | "payments")}
        options={[
          { id: "accounts", label: "חשבונות" },
          { id: "payments", label: "תשלומים" },
        ]}
      />

      {tab === "accounts" && (
        <div className="space-y-4">
          <PortalCard>
            <h2 className="font-black">הגשת חשבון</h2>
            <p className="mt-1 text-xs text-[#5B6470]">הגשה מתוך מדידות מאושרות בלבד. אין אפשרות לאשר חשבון מהפורטל.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                className="min-h-12 rounded-xl border border-[#E6E8EB] px-3"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
              >
                <option value="">בחירת עבודה מאושרת</option>
                {works?.assignments
                  .filter((a) => ["approved", "partial"].includes(a.workStatus))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.projectName} — {a.description}
                    </option>
                  ))}
              </select>
              <Button
                className="min-h-12"
                onClick={() =>
                  apiClient
                    .post("/api/subcontractor/accounts", { assignmentId })
                    .then(() => load())
                    .catch((e) => setError(e.message))
                }
              >
                הגיש חשבון
              </Button>
            </div>
          </PortalCard>
          {accounts.length === 0 && <EmptyState title="עדיין לא הופקו חשבונות" />}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#E6E8EB] bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F8F8F8] text-right text-xs text-[#5B6470]">
                <tr>
                  <th className="px-3 py-3">מספר חשבון</th>
                  <th className="px-3 py-3">פרויקט</th>
                  <th className="px-3 py-3">תאריך</th>
                  <th className="px-3 py-3">לפני מע״מ</th>
                  <th className="px-3 py-3">מע״מ</th>
                  <th className="px-3 py-3">כולל</th>
                  <th className="px-3 py-3">שולם</th>
                  <th className="px-3 py-3">יתרה</th>
                  <th className="px-3 py-3">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-[#E6E8EB]">
                    <td className="px-3 py-3 font-mono text-xs">{a.id.slice(-8)}</td>
                    <td className="px-3 py-3 font-bold">{a.projectName}</td>
                    <td className="px-3 py-3">{a.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-3">{moneyText(a.subtotal ?? a.payable)}</td>
                    <td className="px-3 py-3">{moneyText(a.vatAmount ?? 0)}</td>
                    <td className="px-3 py-3 font-bold">{moneyText(a.payable)}</td>
                    <td className="px-3 py-3">{moneyText(a.paid)}</td>
                    <td className="px-3 py-3">{moneyText(a.remaining)}</td>
                    <td className="px-3 py-3">
                      <StatusPill label={a.statusLabel} className={ACCOUNT_STATUS_COLORS[a.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {accounts.map((a) => (
              <PortalCard key={a.id}>
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#5B6470]">חשבון {a.id.slice(-8)}</p>
                    <p className="font-black">{a.projectName}</p>
                    <p className="text-sm">{a.createdAt.slice(0, 10)}</p>
                  </div>
                  <StatusPill label={a.statusLabel} className={ACCOUNT_STATUS_COLORS[a.status]} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>לפני מע״מ: <b>{moneyText(a.subtotal ?? a.payable)}</b></div>
                  <div>מע״מ: <b>{moneyText(a.vatAmount ?? 0)}</b></div>
                  <div>כולל: <b>{moneyText(a.payable)}</b></div>
                  <div>שולם: <b>{moneyText(a.paid)}</b></div>
                  <div>יתרה: <b>{moneyText(a.remaining)}</b></div>
                </dl>
              </PortalCard>
            ))}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-3">
          {(data.payments ?? []).length === 0 && <EmptyState title="אין תשלומים רשומים" />}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#E6E8EB] bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F8F8F8] text-right text-xs text-[#5B6470]">
                <tr>
                  <th className="px-3 py-3">תאריך</th>
                  <th className="px-3 py-3">סכום</th>
                  <th className="px-3 py-3">אמצעי תשלום</th>
                  <th className="px-3 py-3">חשבון משויך</th>
                  <th className="px-3 py-3">אסמכתא</th>
                </tr>
              </thead>
              <tbody>
                {(data.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-[#E6E8EB]">
                    <td className="px-3 py-3">{p.paidAt.slice(0, 10)}</td>
                    <td className="px-3 py-3 font-bold">{moneyText(p.amount)}</td>
                    <td className="px-3 py-3">{PAYMENT_METHOD_LABELS[p.method] || p.method}</td>
                    <td className="px-3 py-3">{p.accountId ? `${p.projectName || "חשבון"} · ${p.accountId.slice(-6)}` : "ללא שיוך"}</td>
                    <td className="px-3 py-3">{p.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {(data.payments ?? []).map((p) => (
              <PortalCard key={p.id}>
                <p className="font-black">{moneyText(p.amount)}</p>
                <p className="text-sm text-[#5B6470]">
                  {p.paidAt.slice(0, 10)} · {PAYMENT_METHOD_LABELS[p.method] || p.method}
                </p>
                <p className="text-sm">{p.accountId ? `חשבון ${p.accountId.slice(-6)}` : "תשלום ללא שיוך לחשבון"}</p>
                <p className="text-xs text-[#5B6470]">אסמכתא: {p.reference || "—"}</p>
              </PortalCard>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </PortalPage>
  );
}
