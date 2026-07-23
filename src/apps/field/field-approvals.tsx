"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approvalsService,
  opsDeliveryNotesService,
  workDiariesService,
} from "@/features/work-diaries/services/work-diaries.service";

type Row = {
  id: string;
  kind: "work_diary" | "delivery_note";
  number: string;
  status: string;
  projectName?: string;
  comment?: string | null;
  href: string;
  editHref: string;
};

type PendingSheet = {
  documentId: string;
  documentNumber: string;
  title: string;
  projectName?: string;
  version?: number;
};

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  pending_approval: {
    label: "ממתין",
    cls: "bg-amber-500/20 text-amber-200",
  },
  in_approval: {
    label: "ממתין",
    cls: "bg-amber-500/20 text-amber-200",
  },
  approved: { label: "אושר", cls: "bg-emerald-500/20 text-emerald-200" },
  revision: {
    label: "הוחזר לתיקון",
    cls: "bg-orange-500/25 text-orange-100",
  },
  revision_requested: {
    label: "הוחזר לתיקון",
    cls: "bg-orange-500/25 text-orange-100",
  },
  draft: { label: "טיוטה", cls: "bg-white/10 text-white/70" },
  submitted: { label: "נשלח", cls: "bg-sky-500/20 text-sky-200" },
};

export function FieldApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingSheets, setPendingSheets] = useState<PendingSheet[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  function reload() {
    return Promise.all([
      workDiariesService.list().catch(() => ({ items: [] as any[] })),
      opsDeliveryNotesService.list().catch(() => ({ items: [] as any[] })),
      approvalsService.pending().catch(() => ({ items: [] as any[] })),
    ]).then(([diaries, notes, pending]) => {
      const dRows: Row[] = (diaries.items || []).map((d: any) => ({
        id: d.id,
        kind: "work_diary" as const,
        number: d.documentNumber || "יומן",
        status: d.status,
        projectName: d.project?.name,
        comment: d.rejectionComment || d.revisionComment || null,
        href: `/field/work-diaries/${d.id}`,
        editHref: `/field/work-diaries/${d.id}/edit`,
      }));
      const nRows: Row[] = (notes.items || []).map((n: any) => ({
        id: n.id,
        kind: "delivery_note" as const,
        number: n.documentNumber || "תעודה",
        status: n.status,
        projectName: n.project?.name,
        comment: n.rejectionComment || n.revisionComment || null,
        href: `/field/delivery-notes/${n.id}`,
        editHref: `/field/delivery-notes/${n.id}`,
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

      const sheets = (pending.items || [])
        .filter((x: any) => x.kind === "measurement_sheet")
        .map((x: any) => ({
          documentId: x.documentId,
          documentNumber: x.documentNumber,
          title: x.title || "דף מדידה",
          projectName: x.projectName,
          version: x.version,
        }));
      setPendingSheets(sheets);
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function approveSheet(documentId: string) {
    setBusyId(documentId);
    setError("");
    setInfo("");
    try {
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId,
        decision: "approved",
      });
      setInfo("דף המדידה אושר");
      await reload();
    } catch (e: any) {
      setError(e.message || "שגיאה באישור");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectSheet() {
    if (!rejectId || !rejectComment.trim()) {
      setError("חובה לרשום סיבה להחזרה");
      return;
    }
    setBusyId(rejectId);
    setError("");
    setInfo("");
    try {
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId: rejectId,
        decision: "rejected",
        comment: rejectComment.trim(),
      });
      setRejectId(null);
      setRejectComment("");
      setInfo("הוחזר לתיקון");
      await reload();
    } catch (e: any) {
      setError(e.message || "שגיאה בהחזרה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">אישורים</h1>
        <p className="mt-1 text-sm text-white/45">
          יומן/תעודה — סטטוס בלבד · דפי מדידה — אפשר לאשר אם נשלחו אליך
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
          {info}
        </p>
      )}

      {loading && <p className="py-12 text-center text-white/40">טוען…</p>}

      {!!pendingSheets.length && (
        <section className="space-y-3">
          <h2 className="text-sm font-black text-teal-300">
            דפי מדידה לאישור שלך
          </h2>
          {pendingSheets.map((sheet) => (
            <div
              key={sheet.documentId}
              className="rounded-3xl border border-teal-500/30 bg-teal-500/10 p-4"
            >
              <p className="text-xs text-teal-200/80">דף מדידה / דוח ביצוע</p>
              <p className="mt-1 font-black">{sheet.title}</p>
              <p className="mt-1 text-sm text-white/55">
                {sheet.documentNumber}
                {sheet.version ? ` · V${sheet.version}` : ""}
                {sheet.projectName ? ` · ${sheet.projectName}` : ""}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === sheet.documentId}
                  onClick={() => void approveSheet(sheet.documentId)}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-500 text-base font-black text-[#052e16] disabled:opacity-60"
                >
                  {busyId === sheet.documentId ? "…" : "אשר"}
                </button>
                <button
                  type="button"
                  disabled={busyId === sheet.documentId}
                  onClick={() => {
                    setRejectId(sheet.documentId);
                    setRejectComment("");
                  }}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-orange-500 text-base font-black text-orange-950 disabled:opacity-60"
                >
                  החזר לתיקון
                </button>
              </div>
              {rejectId === sheet.documentId && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="סיבת ההחזרה"
                    className="min-h-20 w-full rounded-2xl border border-white/15 bg-[#0b1220] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busyId === sheet.documentId}
                    onClick={() => void rejectSheet()}
                    className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-white text-base font-black text-stone-900"
                  >
                    שלח החזרה
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {!loading && rows.length === 0 && pendingSheets.length === 0 && (
        <p className="rounded-3xl border border-dashed border-white/15 py-12 text-center text-white/45">
          אין מסמכים להצגה
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const ui = STATUS_UI[row.status] || {
            label: row.status,
            cls: "bg-white/10 text-white/70",
          };
          const needsFix =
            row.status === "revision" || row.status === "revision_requested";
          return (
            <Link
              key={`${row.kind}-${row.id}`}
              href={needsFix ? row.editHref : row.href}
              className="block rounded-3xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-white/40">
                    {row.kind === "work_diary" ? "יומן עבודה" : "תעודת משלוח"}
                  </p>
                  <p className="mt-1 font-black">{row.number}</p>
                  {row.projectName && (
                    <p className="mt-1 text-sm text-white/50">{row.projectName}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ui.cls}`}
                >
                  {ui.label}
                </span>
              </div>
              {needsFix && (
                <>
                  <div className="mt-3 rounded-2xl bg-orange-500/15 px-3 py-2 text-sm text-orange-100">
                    {row.comment || "הוחזר לתיקון — פתח, תקן ושלח שוב"}
                  </div>
                  <p className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-orange-500 text-base font-black text-orange-950">
                    תקן ושלח שוב
                  </p>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
