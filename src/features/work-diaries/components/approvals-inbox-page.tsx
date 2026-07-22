"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";

function kindLabel(kind: string) {
  if (kind === "work_diary") return "יומן עבודה";
  if (kind === "delivery_note") return "תעודת משלוח";
  if (kind === "measurement_sheet") return "דוח ביצוע";
  return kind;
}

export function ApprovalsInboxPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectKind, setRejectKind] = useState<string>("work_diary");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    return approvalsService
      .pending()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function approve(item: any) {
    setBusy(true);
    setError("");
    try {
      await approvalsService.decide({
        kind: item.kind,
        documentId: item.documentId,
        decision: "approved",
      });
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectId || !comment.trim()) {
      setError("חובה לרשום סיבה להחזרה לתיקון");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await approvalsService.decide({
        kind: rejectKind as any,
        documentId: rejectId,
        decision: "rejected",
        comment: comment.trim(),
      });
      setRejectId(null);
      setComment("");
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03142F]">
          מסמכים ממתינים לאישור
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          יומני עבודה · תעודות משלוח · דוחות ביצוע
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">טוען…</p>}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          אין מסמכים ממתינים לאישור
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.approvalId}`}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs text-gray-400">{kindLabel(item.kind)}</p>
                <p className="font-bold text-[#03142F]">
                  {item.documentNumber || item.title}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {item.projectName || item.project?.name || "ללא פרויקט"}
                  {item.createdByName ? ` · ${item.createdByName}` : ""}
                  {item.foremanName ? ` · ${item.foremanName}` : ""}
                  {item.version ? ` · V${item.version}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  נשלח: {new Date(item.sentAt).toLocaleString("he-IL")}
                </p>
                {item.link && (
                  <Link
                    href={item.link}
                    className="mt-2 inline-block text-xs font-semibold text-primary-700"
                  >
                    פתיחת הדוח ←
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approve(item)}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  <Check className="h-4 w-4" />
                  אשר
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRejectId(item.documentId);
                    setRejectKind(item.kind);
                    setComment("");
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  <X className="h-4 w-4" />
                  החזר לתיקון
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="text-lg font-bold">הערות מנהל — החזרה לתיקון</h3>
            <textarea
              className="min-h-28 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="לדוגמה: חדר 4 · סעיף 12 · חסרה תמונה / כמות לא תואמת"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                שלח חזרה למנהל העבודה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
