"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import {
  DIARY_STATUS_LABELS,
  EmptyState,
  ErrorState,
  FilterRow,
  PortalCard,
  PortalPage,
  SkeletonGrid,
  StatusPill,
} from "@/apps/subcontractor/portal-ui";

type Diary = {
  id: string;
  assignmentId?: string | null;
  documentNumber: string;
  projectName: string;
  workSiteName: string | null;
  workDate: string;
  workSummary: string | null;
  status: string;
  mediaCount?: number;
  signedPdfUrl?: string | null;
};

type Works = {
  assignments: Array<{
    id: string;
    projectName: string;
    workStatus: string;
  }>;
  diaries: Diary[];
};

const FILTERS = [
  { id: "all", label: "הכול", match: () => true },
  { id: "draft", label: "טיוטות", match: (s: string) => s === "draft" },
  {
    id: "pending",
    label: "ממתינים לאישור",
    match: (s: string) => ["pending_approval", "in_approval", "assigned", "in_progress"].includes(s),
  },
  { id: "approved", label: "אושרו", match: (s: string) => ["approved", "sent_to_client", "signed"].includes(s) },
  { id: "returned", label: "הוחזרו לתיקון", match: (s: string) => ["returned", "rejected"].includes(s) },
] as const;

export default function Page() {
  const [data, setData] = useState<Works | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  function load() {
    apiClient
      .get<Works>("/api/subcontractor/works")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<Works>("/api/subcontractor/works")
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, []);

  const canCreate = !!data?.assignments.some((a) =>
    ["assigned", "in_progress", "returned"].includes(a.workStatus)
  );
  const createHref =
    data?.assignments.find((a) => ["in_progress", "returned"].includes(a.workStatus))?.id ||
    data?.assignments.find((a) => a.workStatus === "assigned")?.id;

  const filtered = useMemo(() => {
    const rule = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
    return (data?.diaries ?? []).filter((d) => rule.match(String(d.status)));
  }, [data, filter]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonGrid />;

  return (
    <PortalPage
      title="הדיווחים שלי"
      subtitle="יומני ביצוע שנשלחו מהעבודות שהוקצו אליך"
      actions={
        canCreate && createHref ? (
          <Link
            href={`/subcontractor/works/${createHref}#report`}
            className="inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-sm font-bold text-white"
          >
            + דיווח חדש
          </Link>
        ) : undefined
      }
    >
      <FilterRow
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
      />
      {filtered.length === 0 && (
        <EmptyState title="עדיין אין דיווחים להצגה" text="פתחו עבודה שהוקצתה אליכם ושלחו דיווח ביצוע." />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((d) => (
          <PortalCard key={d.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#5B6470]">מספר דיווח {d.documentNumber}</p>
                <p className="text-lg font-black">{d.projectName}</p>
              </div>
              <StatusPill
                label={DIARY_STATUS_LABELS[d.status] || d.status}
                className="bg-slate-100 text-slate-700"
              />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-[#5B6470]">סניף עבודה</dt>
                <dd className="font-bold">{d.workSiteName || "ללא סניף"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">תאריך</dt>
                <dd className="font-bold">{d.workDate}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">סוג דיווח</dt>
                <dd className="font-bold">יומן ביצוע</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#5B6470]">תמונות מצורפות</dt>
                <dd className="font-bold">{d.mediaCount ?? 0}</dd>
              </div>
            </dl>
            {d.workSummary && <p className="mt-2 text-sm text-[#5B6470]">{d.workSummary}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {d.assignmentId && (
                <Link
                  href={`/subcontractor/works/${d.assignmentId}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-xs font-bold text-white"
                >
                  צפייה
                </Link>
              )}
              {d.assignmentId && ["draft", "returned", "rejected"].includes(String(d.status)) && (
                <Link
                  href={`/subcontractor/works/${d.assignmentId}#report`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-[#E6E8EB] px-4 text-xs font-bold"
                >
                  עריכה
                </Link>
              )}
              {d.signedPdfUrl && (
                <a
                  href={d.signedPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl border border-[#E6E8EB] px-4 text-xs font-bold"
                >
                  פתיחת PDF
                </a>
              )}
            </div>
          </PortalCard>
        ))}
      </div>
    </PortalPage>
  );
}
