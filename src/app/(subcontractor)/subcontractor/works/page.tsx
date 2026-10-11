"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import {
  EmptyState,
  ErrorState,
  FilterRow,
  PortalCard,
  PortalPage,
  SkeletonGrid,
  StatusPill,
} from "@/apps/subcontractor/portal-ui";
import { WORK_STATUS_COLORS, WORK_STATUS_LABELS } from "@/lib/subcontractors/constants";

type Assignment = {
  id: string;
  projectName: string;
  contractNumber?: string | null;
  workSiteName: string | null;
  description: string;
  engagementLabel?: string;
  startDate: string | null;
  workStatus: string;
  workStatusLabel: string;
  managerName?: string | null;
};

export default function Page() {
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  function load() {
    apiClient
      .get<{ assignments: Assignment[] }>("/api/subcontractor/works")
      .then((r) => setItems(r.assignments))
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ assignments: Assignment[] }>("/api/subcontractor/works")
      .then((r) => {
        if (live) setItems(r.assignments);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((a) => {
      if (filter === "active") return ["assigned", "in_progress", "returned"].includes(a.workStatus);
      if (filter === "pending") return a.workStatus === "submitted";
      if (filter === "done") return ["approved", "partial"].includes(a.workStatus);
      return true;
    });
  }, [items, filter]);

  if (error && !items) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <SkeletonGrid />;

  return (
    <PortalPage title="העבודות שלי" subtitle="כל העבודות שהוקצו אליי">
      <FilterRow
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "הכול" },
          { id: "active", label: "פעילות" },
          { id: "pending", label: "ממתינות" },
          { id: "done", label: "הושלמו" },
        ]}
      />
      {filtered.length === 0 && (
        <EmptyState title="לא הוקצו לך עבודות כרגע" text="כשתוקצה עבודה היא תופיע כאן." />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((a) => (
          <PortalCard key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-black">{a.projectName}</p>
                <p className="text-xs font-semibold text-[#5B6470]">
                  מספר עבודה {a.contractNumber || a.id.slice(-6)}
                </p>
              </div>
              <StatusPill
                label={a.workStatusLabel || WORK_STATUS_LABELS[a.workStatus]}
                className={WORK_STATUS_COLORS[a.workStatus]}
              />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-[#5B6470]">סניף עבודה</dt>
                <dd className="font-bold">{a.workSiteName || "ללא סניף"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">סוג עבודה</dt>
                <dd className="font-bold">{a.engagementLabel || a.description}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">תיאור</dt>
                <dd className="font-bold">{a.description}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">תאריך התחלה</dt>
                <dd className="font-bold">{a.startDate?.slice(0, 10) || "לא צוין"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">מנהל שטח</dt>
                <dd className="font-bold">{a.managerName || "לא צוין"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/subcontractor/works/${a.id}`}
                className="inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-xs font-bold text-white"
              >
                פתח עבודה
              </Link>
              <Link
                href={`/subcontractor/works/${a.id}#report`}
                className="inline-flex min-h-11 items-center rounded-xl border border-[#E6E8EB] px-4 text-xs font-bold"
              >
                שלח דיווח
              </Link>
              <Link
                href={`/subcontractor/measurements?work=${a.id}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-[#E6E8EB] px-4 text-xs font-bold"
              >
                צפה במדידות
              </Link>
            </div>
          </PortalCard>
        ))}
      </div>
    </PortalPage>
  );
}
