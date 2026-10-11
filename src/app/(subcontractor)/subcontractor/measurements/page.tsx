"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import {
  EmptyState,
  ErrorState,
  FilterRow,
  KpiCard,
  PortalCard,
  PortalPage,
  SkeletonGrid,
  StatusPill,
  MEASUREMENT_STATUS_COLORS,
  moneyText,
} from "@/apps/subcontractor/portal-ui";

type Item = {
  id: string;
  assignmentId?: string;
  status: string;
  statusLabel: string;
  projectName: string;
  workSiteName?: string | null;
  reportedTotal: number;
  approvedTotal: number;
  createdAt: string;
};

export default function Page() {
  return (
    <Suspense fallback={<SkeletonGrid />}>
      <MeasurementsScreen />
    </Suspense>
  );
}

function MeasurementsScreen() {
  const { canViewFinance } = usePortalSession("subcontractor");
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const workId = searchParams.get("work");

  function load() {
    apiClient
      .get<{ items: Item[] }>("/api/subcontractor/measurements")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ items: Item[] }>("/api/subcontractor/measurements")
      .then((r) => {
        if (live) setItems(r.items);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, []);

  const scoped = useMemo(() => {
    const list = items ?? [];
    return workId ? list.filter((i) => i.assignmentId === workId) : list;
  }, [items, workId]);

  const filtered = useMemo(() => {
    return scoped.filter((i) => (filter === "all" ? true : i.status === filter));
  }, [scoped, filter]);

  const summary = useMemo(() => ({
    draft: scoped.filter((i) => i.status === "draft").length,
    pending: scoped.filter((i) => ["submitted", "in_review"].includes(i.status)).length,
    approved: scoped.filter((i) => i.status === "approved").length,
    returned: scoped.filter((i) => i.status === "returned").length,
  }), [scoped]);

  if (error && !items) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <SkeletonGrid />;

  return (
    <PortalPage title="המדידות שלי" subtitle="מדידות ביצוע מהעבודות שהוקצו אליך">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="מדידות בטיוטה" value={String(summary.draft)} />
        <KpiCard label="ממתינות לאישור" value={String(summary.pending)} tone="warning" />
        <KpiCard label="אושרו" value={String(summary.approved)} tone="success" />
        <KpiCard label="הוחזרו לתיקון" value={String(summary.returned)} tone="warning" />
      </div>
      <FilterRow
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "הכול" },
          { id: "draft", label: "טיוטות" },
          { id: "submitted", label: "ממתינות" },
          { id: "approved", label: "אושרו" },
          { id: "returned", label: "הוחזרו" },
        ]}
      />
      {filtered.length === 0 && (
        <EmptyState title="אין מדידות להצגה" text="מדידות יופיעו כאן לאחר יצירה או הגשה." />
      )}
      <div className="hidden overflow-x-auto rounded-2xl border border-[#E6E8EB] bg-white md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F8F8] text-right text-xs text-[#5B6470]">
            <tr>
              <th className="px-4 py-3">מספר מדידה</th>
              <th className="px-4 py-3">פרויקט</th>
              <th className="px-4 py-3">סניף</th>
              <th className="px-4 py-3">תאריך</th>
              {canViewFinance && <th className="px-4 py-3">סכום מדווח</th>}
              <th className="px-4 py-3">סטטוס</th>
              <th className="px-4 py-3">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-[#E6E8EB]">
                <td className="px-4 py-3 font-mono text-xs">{m.id.slice(-8)}</td>
                <td className="px-4 py-3 font-bold">{m.projectName}</td>
                <td className="px-4 py-3">{m.workSiteName || "—"}</td>
                <td className="px-4 py-3">{m.createdAt.slice(0, 10)}</td>
                {canViewFinance && <td className="px-4 py-3">{moneyText(m.reportedTotal)}</td>}
                <td className="px-4 py-3">
                  <StatusPill label={m.statusLabel} className={MEASUREMENT_STATUS_COLORS[m.status]} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/subcontractor/measurements/${m.id}`} className="font-bold text-[#C8102E]">
                    פתח
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {filtered.map((m) => (
          <PortalCard key={m.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-[#5B6470]">מדידה {m.id.slice(-8)}</p>
                <p className="font-black">{m.projectName}</p>
                <p className="text-sm text-[#5B6470]">{m.workSiteName || "ללא סניף"} · {m.createdAt.slice(0, 10)}</p>
                {canViewFinance && <p className="mt-1 text-sm font-bold">{moneyText(m.reportedTotal)}</p>}
              </div>
              <StatusPill label={m.statusLabel} className={MEASUREMENT_STATUS_COLORS[m.status]} />
            </div>
            <Link
              href={`/subcontractor/measurements/${m.id}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-xs font-bold text-white"
            >
              פתח מדידה
            </Link>
          </PortalCard>
        ))}
      </div>
    </PortalPage>
  );
}
