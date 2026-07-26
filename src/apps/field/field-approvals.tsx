"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  opsDeliveryNotesService,
  workDiariesService,
} from "@/features/work-diaries/services/work-diaries.service";
import { FieldEmptyState, FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  kind: "work_diary" | "delivery_note";
  number: string;
  status: string;
  projectName?: string;
  comment?: string | null;
  href: string;
  fixHref: string;
};

const STATUS_UI: Record<string, { label: string; emoji: string; cls: string }> =
  {
    pending_approval: {
      label: "ממתין",
      emoji: "🟡",
      cls: field.badge.yellow,
    },
    in_approval: {
      label: "ממתין",
      emoji: "🟡",
      cls: field.badge.yellow,
    },
    approved: {
      label: "אושר",
      emoji: "🟢",
      cls: field.badge.green,
    },
    revision: {
      label: "הוחזר לתיקון",
      emoji: "🔴",
      cls: field.badge.orange,
    },
    revision_requested: {
      label: "הוחזר לתיקון",
      emoji: "🔴",
      cls: field.badge.orange,
    },
    draft: { label: "טיוטה", emoji: "⚪", cls: field.badge.gray },
    submitted: { label: "נשלח", emoji: "🟡", cls: field.badge.blue },
  };

export function FieldApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workDiariesService.list().catch(() => ({ items: [] as any[] })),
      opsDeliveryNotesService.list().catch(() => ({ items: [] as any[] })),
    ])
      .then(([diaries, notes]) => {
        const dRows: Row[] = (diaries.items || []).map((d: any) => ({
          id: d.id,
          kind: "work_diary" as const,
          number: d.documentNumber || "יומן",
          status: d.status,
          projectName: d.project?.name,
          comment: d.rejectionComment || d.revisionComment || null,
          href: `/field/work-diaries/${d.id}`,
          fixHref: `/field/work-diaries/new?reviseId=${d.id}`,
        }));
        const nRows: Row[] = (notes.items || []).map((n: any) => ({
          id: n.id,
          kind: "delivery_note" as const,
          number: n.documentNumber || "תעודה",
          status: n.status,
          projectName: n.project?.name,
          comment: n.rejectionComment || n.revisionComment || null,
          href: `/field/delivery-notes/${n.id}`,
          fixHref: `/field/delivery-notes/new?reviseId=${n.id}`,
        }));
        const merged = [...dRows, ...nRows].sort((a, b) => {
          const rank = (s: string) =>
            s === "revision" || s === "revision_requested"
              ? 0
              : s === "pending_approval" || s === "in_approval"
                ? 1
                : 2;
          return rank(a.status) - rank(b.status);
        });
        setRows(merged);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <FieldPageHeader
        title="אישורים"
        subtitle="המסמכים שלך — אושר · ממתין · הוחזר"
      />

      {error && <p className={field.error}>{error}</p>}

      {loading && (
        <p className="py-12 text-center text-lg text-[#6B7280]">טוען…</p>
      )}

      {!loading && rows.length === 0 && (
        <FieldEmptyState
          emoji="✅"
          title="אין מסמכים להצגה"
          description="כאן יופיעו יומנים ותעודות ששלחתם לאישור."
        />
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const ui = STATUS_UI[row.status] || {
            label: row.status,
            emoji: "⚪",
            cls: field.badge.gray,
          };
          const needsFix =
            row.status === "revision" || row.status === "revision_requested";
          return (
            <Link
              key={`${row.kind}-${row.id}`}
              href={needsFix ? row.fixHref : row.href}
              className={cn(field.cardInteractive, "block overflow-hidden p-0")}
            >
              {needsFix && <div className="h-1.5 w-full bg-orange-500" />}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-[#6B7280]">
                      {row.kind === "work_diary"
                        ? "יומן עבודה"
                        : "תעודת משלוח"}
                    </p>
                    <p className="mt-1 text-xl font-black text-[#111827]">
                      {row.number}
                    </p>
                    {row.projectName && (
                      <p className="mt-2 text-base text-[#6B7280]">
                        {row.projectName}
                      </p>
                    )}
                  </div>
                  <span className={ui.cls}>
                    {ui.emoji} {ui.label}
                  </span>
                </div>
                {needsFix && (
                  <>
                    <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-base text-orange-900">
                      {row.comment || "הוחזר לתיקון — פתח, תקן ושלח שוב"}
                    </div>
                    <p className={cn(field.btnDanger, "mt-4 bg-orange-500")}>
                      תקן ושלח שוב
                    </p>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
