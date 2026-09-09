"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, TriangleAlert, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { formatNumber } from "@/utils/format";
import { calculateMeasurementQuantity } from "@/lib/measurement/quantities";

/** Single measurement sheet for Ops approval — not the full projects workspace */
export function OpsMeasurementReview({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<any>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sendResult, setSendResult] = useState<{
    url: string;
    whatsappUrl: string;
  } | null>(null);

  useEffect(() => {
    apiClient
      .get<any>(`/api/measurement-sheets/${sheetId}`)
      .then(setSheet)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sheetId]);

  const sections = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of sheet?.cells ?? []) {
      if (c.boqItem) map.set(c.boqItemId, c.boqItem);
    }
    return [...map.values()].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "he")
    );
  }, [sheet]);

  const rooms: any[] = sheet?.rows ?? [];
  const pending = sheet?.status === "pending_approval";

  function qty(rowId: string, boqId: string) {
    const cell = (sheet?.cells ?? []).find(
      (c: any) => c.rowId === rowId && c.boqItemId === boqId
    );
    return Number(cell?.quantity ?? 0);
  }

  const quantitySummaries = useMemo(
    () =>
      sections.map((section) => {
        const currentQuantity = rooms.reduce(
          (sum, row) => sum + qty(row.id, section.id),
          0
        );
        return {
          section,
          metrics: calculateMeasurementQuantity({
            contractQuantity: Number(section.contractQuantity) || 0,
            previousApprovedQuantity:
              Number(
                section.previousApprovedQuantity ??
                  section.invoicedQuantity
              ) || 0,
            currentQuantity,
          }),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, rooms, sheet]
  );
  const overruns = quantitySummaries.filter(
    ({ metrics }) => metrics.isOverrun
  );

  async function approve() {
    setBusy(true);
    setError("");
    try {
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId: sheetId,
        decision: "approved",
      });
      const refreshed = await apiClient.get<any>(
        `/api/measurement-sheets/${sheetId}`
      );
      setSheet(refreshed);
      setInfo("הדוח אושר");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim()) {
      setError("חובה לרשום סיבה להחזרה");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId: sheetId,
        decision: "rejected",
        comment: comment.trim(),
      });
      setRejectOpen(false);
      router.push("/operations/approvals");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendToClient() {
    setBusy(true);
    setError("");
    try {
      const result = await apiClient.post<{
        url: string;
        whatsappUrl: string;
      }>(`/api/measurement-sheets/${sheetId}/send-client`, { phone });
      setSendResult(result);
      setInfo("נוצר קישור ללקוח — אפשר לשלוח בוואטסאפ");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-stone-400">טוען דוח…</p>;
  }

  if (!sheet) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">{error || "הדוח לא נמצא"}</p>
        <Link href="/operations/approvals" className="text-sm font-bold text-amber-800">
          ← חזרה לאישורים
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/operations/approvals"
        className="inline-flex items-center gap-1 text-sm font-bold text-amber-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לאישורים
      </Link>

      <div>
        <p className="text-xs font-bold text-amber-700">דוח ביצוע שנשלח אליך</p>
        <h2 className="mt-1 text-2xl font-black text-stone-900">{sheet.title}</h2>
        <p className="mt-1 text-sm text-stone-500">
          {sheet.project?.name} · MS-{sheet.sequenceNumber}
          {sheet.currentVersion ? ` · V${sheet.currentVersion}` : ""}
          {sheet.status ? ` · ${sheet.status}` : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {info && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {info}
        </p>
      )}

      {!!overruns.length && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-950">
          <p className="flex items-center gap-2 font-black">
            <TriangleAlert className="h-5 w-5 text-red-700" />
            חריגה מכמות חוזה
          </p>
          <div className="mt-2 space-y-1 text-sm">
            {overruns.map(({ section, metrics }) => (
              <p key={section.id}>
                <span className="font-bold">
                  {section.code} · {section.description}
                </span>
                {" — "}כמות חוזה: {formatNumber(metrics.contractQuantity)},
                ביצוע: {formatNumber(metrics.cumulativeQuantity)}, חריגה: +
                {formatNumber(metrics.overrunQuantity)}
              </p>
            ))}
          </div>
          <p className="mt-2 text-xs font-bold">
            ניתן לאשר את המדידה או להחזיר אותה לתיקון.
          </p>
        </div>
      )}

      <div className="overflow-auto rounded-2xl bg-white ring-1 ring-amber-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-amber-50">
            <tr>
              <th className="border-b border-amber-100 px-3 py-2 text-right">
                שורה / יחידה
              </th>
              {sections.map((s) => (
                <th key={s.id} className="border-b border-amber-100 px-2 py-2 text-center">
                  <p className="font-mono text-[10px] text-stone-400">{s.code}</p>
                  <p className="line-clamp-2 text-xs font-bold">{s.description}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-stone-50">
                <td className="px-3 py-2 font-bold">{room.name}</td>
                {sections.map((s) => (
                  <td key={s.id} className="px-2 py-2 text-center">
                    {formatNumber(qty(room.id, s.id))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/print/measurement-sheets/${sheetId}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold"
        >
          הדפסה / PDF
        </a>
        {pending && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void approve()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              אשר
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700"
            >
              <X className="h-4 w-4" />
              החזר לתיקון
            </button>
          </>
        )}
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="text-lg font-black">החזרה לתיקון</h3>
            <textarea
              className="min-h-28 w-full rounded-xl border px-3 py-2 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="סיבת ההחזרה"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-bold"
                onClick={() => setRejectOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white"
              >
                שלח חזרה
              </button>
            </div>
          </div>
        </div>
      )}

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="text-lg font-black">שליחת קישור ללקוח</h3>
            <p className="text-sm text-stone-500">
              הלקוח יראה את נתוני הדוח ויוכל לרשום חתימה
            </p>
            <label className="block text-sm">
              טלפון לקוח (אופציונלי לוואטסאפ)
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
              />
            </label>
            {sendResult && (
              <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm">
                <p className="break-all font-mono text-xs text-emerald-900">
                  {sendResult.url}
                </p>
                <a
                  href={sendResult.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 font-bold text-white"
                >
                  פתח WhatsApp
                </a>
                <button
                  type="button"
                  className="w-full rounded-xl border py-2 text-xs font-bold"
                  onClick={() => void navigator.clipboard.writeText(sendResult.url)}
                >
                  העתק קישור
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-bold"
                onClick={() => {
                  setSendOpen(false);
                  setSendResult(null);
                }}
              >
                סגור
              </button>
              {!sendResult && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendToClient()}
                  className="flex-1 rounded-xl bg-amber-700 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? "יוצר…" : "צור קישור"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
