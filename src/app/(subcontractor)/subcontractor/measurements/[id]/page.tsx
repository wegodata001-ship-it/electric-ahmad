"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import {
  ErrorState,
  MEASUREMENT_STATUS_COLORS,
  PortalCard,
  PortalPage,
  StatusPill,
  formatDate,
  moneyText,
} from "@/apps/subcontractor/portal-ui";

type Detail = {
  id: string;
  projectName: string;
  workSiteName?: string | null;
  assignmentDescription: string;
  status: string;
  statusLabel: string;
  notes: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  items: Array<{
    id: string;
    description: string;
    unit: string;
    reportedQty: number;
    approvedQty: number | null;
    unitPrice: number;
    reportedAmount: number;
    approvedAmount: number | null;
    notes: string | null;
  }>;
  reportedTotal: number;
  approvedTotal: number;
};

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const { canViewFinance } = usePortalSession("subcontractor");
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function load() {
    apiClient
      .get<Detail>(`/api/subcontractor/measurements/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<Detail>(`/api/subcontractor/measurements/${id}`)
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  const canSubmit = ["draft", "returned"].includes(data.status);

  return (
    <PortalPage
      title={`מדידה ${data.id.slice(-8)}`}
      subtitle={`${data.projectName} · ${data.workSiteName || "ללא סניף"}`}
      actions={
        <StatusPill label={data.statusLabel} className={MEASUREMENT_STATUS_COLORS[data.status]} />
      }
    >
      {data.reviewNotes && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          הוחזר: {data.reviewNotes}
        </p>
      )}
      <PortalCard>
        <h2 className="font-black">שורות המדידה</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F8F8F8] text-right text-xs text-[#5B6470]">
              <tr>
                <th className="px-3 py-2">תיאור</th>
                <th className="px-3 py-2">כמות</th>
                <th className="px-3 py-2">יחידה</th>
                {canViewFinance && <th className="px-3 py-2">סכום מדווח</th>}
                <th className="px-3 py-2">הערות</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-[#E6E8EB]">
                  <td className="px-3 py-2 font-bold">{item.description}</td>
                  <td className="px-3 py-2">{item.reportedQty}</td>
                  <td className="px-3 py-2">{item.unit}</td>
                  {canViewFinance && <td className="px-3 py-2">{moneyText(item.reportedAmount)}</td>}
                  <td className="px-3 py-2 text-[#5B6470]">{item.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canViewFinance && (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>סך מדווח: <b>{moneyText(data.reportedTotal)}</b></p>
            <p>סך מאושר: <b>{moneyText(data.approvedTotal)}</b></p>
          </div>
        )}
      </PortalCard>
      <PortalCard>
        <h2 className="font-black">היסטוריית אישורים</h2>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between"><span>נוצרה</span><span>{formatDate(data.submittedAt) === "—" ? "טיוטה" : formatDate(data.submittedAt)}</span></li>
          {data.submittedAt && <li className="flex justify-between"><span>הוגשה</span><span>{formatDate(data.submittedAt)}</span></li>}
          {data.reviewedAt && <li className="flex justify-between"><span>נסקרה</span><span>{formatDate(data.reviewedAt)}</span></li>}
        </ol>
        {data.notes && <p className="mt-3 text-sm text-[#5B6470]">{data.notes}</p>}
      </PortalCard>
      {canSubmit && (
        <Button
          className="min-h-12 w-full"
          onClick={() =>
            apiClient
              .patch(`/api/subcontractor/measurements/${id}`, {})
              .then(() => {
                setOk("המדידה הוגשה לבדיקה");
                load();
              })
              .catch((e) => setError(e.message))
          }
        >
          שלח לאישור
        </Button>
      )}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </PortalPage>
  );
}
