"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approvalsService,
  opsDeliveryNotesService,
  workDiariesService,
} from "@/features/work-diaries/services/work-diaries.service";
import { FieldEmptyState, FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  kind: "work_diary" | "delivery_note" | "measurement_sheet";
  number: string;
  status: string;
  projectName?: string;
  comment?: string | null;
  title?: string;
  href: string;
  fixHref?: string;
  inbound?: boolean;
};

const STATUS_UI: Record<string, { label: string; emoji: string; cls: string }> =
  {
    pending_approval: {
      label: "ממתין לאישורך",
      emoji: "🟡",
      cls: field.badge.yellow,
    },
    in_approval: {
      label: "ממתין לאישורך",
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

function kindLabel(kind: Row["kind"]) {
  if (kind === "work_diary") return "יומן עבודה";
  if (kind === "delivery_note") return "תעודת משלוח";
  return "דף מדידה";
}

export function FieldApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      approvalsService.pending().catch(() => ({ items: [] as any[] })),
      workDiariesService.list().catch(() => ({ items: [] as any[] })),
      opsDeliveryNotesService.list().catch(() => ({ items: [] as any[] })),
    ])
      .then(([pending, diaries, notes]) => {
        const inbound: Row[] = (pending.items || [])
          .filter((p: any) => p.kind === "measurement_sheet")
          .map((p: any) => ({
            id: p.documentId,
            kind: "measurement_sheet" as const,
            number: p.documentNumber || "דף מדידה",
            status: p.status || "pending_approval",
            projectName: p.projectName,
            title: p.title,
            comment: null,
            href: `/field/approvals/review/measurement_sheet/${p.documentId}`,
            inbound: true,
          }));

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

        const merged = [...inbound, ...dRows, ...nRows].sort((a, b) => {
          const rank = (s: string, inboundItem?: boolean) =>
            inboundItem
              ? 0
              : s === "revision" || s === "revision_requested"
                ? 1
                : s === "pending_approval" || s === "in_approval"
                  ? 2
                  : 3;
          return rank(a.status, a.inbound) - rank(b.status, b.inbound);
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
        subtitle="דפי מדידה לאישורך · יומנים ותעודות ששלחת"
      />

      {error && <p className={field.error}>{error}</p>}

      {loading && (
        <p className="py-12 text-center text-lg text-[#6B7280]">טוען…</p>
      )}

      {!loading && rows.length === 0 && (
        <FieldEmptyState
          emoji="✅"
          title="אין מסמכים להצגה"
          description="כאן יופיעו דפי מדידה שנשלחו אליך לאישור, ויומנים/תעודות ששלחתם."
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
              href={needsFix && row.fixHref ? row.fixHref : row.href}
              className={cn(field.cardInteractive, "block overflow-hidden p-0")}
            >
              {(needsFix || row.inbound) && (
                <div
                  className={cn(
                    "h-1.5 w-full",
                    needsFix ? "bg-orange-500" : "bg-teal-500"
                  )}
                />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-[#6B7280]">
                      {kindLabel(row.kind)}
                      {row.inbound ? " · לאישורך" : ""}
                    </p>
                    <p className="mt-1 text-xl font-black text-[#111827]">
                      {row.title || row.number}
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
                {row.inbound && !needsFix && (
                  <p className={cn(field.btnPrimary, "mt-4")}>פתח לאישור</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
