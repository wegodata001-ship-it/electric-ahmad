"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
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
  const [info, setInfo] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectKind, setRejectKind] = useState<string>("work_diary");
  const [comment, setComment] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendSheetId, setSendSheetId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [sendResult, setSendResult] = useState<{
    url: string;
    whatsappUrl: string;
  } | null>(null);

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
    const key = `${item.kind}-${item.documentId}`;
    setBusyId(key);
    setError("");
    setInfo("");
    try {
      const result = (await approvalsService.decide({
        kind: item.kind,
        documentId: item.documentId,
        decision: "approved",
      })) as {
        awaitingOtherApprovers?: boolean;
        approvalComplete?: boolean;
        documentNumber?: string;
        status?: string;
      };

      if (result?.awaitingOtherApprovers) {
        setInfo(
          `האישור נרשם עבור ${result.documentNumber ?? "המסמך"}. המסמך עדיין ממתין למאשרים נוספים.`
        );
      } else if (
        item.kind === "measurement_sheet" &&
        (result?.status === "approved" || result?.status === "locked")
      ) {
        setInfo("הדוח אושר — שלח קישור ללקוח לחתימה");
        setSendSheetId(item.documentId);
        setPhone("");
        setSendResult(null);
      } else if (item.kind === "measurement_sheet") {
        setInfo("האישור נרשם. הדוח עדיין ממתין למאשרים נוספים.");
      } else {
        setInfo(
          `${result?.documentNumber ?? "המסמך"} אושר בהצלחה והוסר מרשימת הממתינים.`
        );
      }
      await reload();
    } catch (e: any) {
      setError(e.message || "שגיאה באישור המסמך");
    } finally {
      setBusyId(null);
    }
  }

  async function sendClientLink() {
    if (!sendSheetId) return;
    setBusyId(`send-${sendSheetId}`);
    setError("");
    try {
      const result = await approvalsService.sendMeasurementSheetToClient(
        sendSheetId,
        phone || undefined
      );
      setSendResult({ url: result.url, whatsappUrl: result.whatsappUrl });
      setInfo("נוצר קישור ללקוח עם נתוני הדוח לחתימה");
    } catch (e: any) {
      setError(e.message || "שגיאה ביצירת קישור");
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejectId || !comment.trim()) {
      setError("חובה לרשום סיבה להחזרה לתיקון");
      return;
    }
    setBusyId(`reject-${rejectId}`);
    setError("");
    setInfo("");
    try {
      await approvalsService.decide({
        kind: rejectKind as any,
        documentId: rejectId,
        decision: "rejected",
        comment: comment.trim(),
      });
      setRejectId(null);
      setComment("");
      setInfo("המסמך הוחזר לתיקון");
      await reload();
    } catch (e: any) {
      setError(e.message || "שגיאה בהחזרה לתיקון");
    } finally {
      setBusyId(null);
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
      {info && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">טוען…</p>}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          אין מסמכים ממתינים לאישור
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const key = `${item.kind}-${item.documentId}`;
          const busy = busyId === key;
          const openHref =
            item.kind === "measurement_sheet"
              ? `/operations/approvals/sheets/${item.documentId}`
              : item.link;
          return (
            <div
              key={`${item.kind}-${item.approvalId}`}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs text-gray-400">
                    {kindLabel(item.kind)}
                  </p>
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
                  {openHref && (
                    <Link
                      href={openHref}
                      className="mt-2 inline-block text-xs font-semibold text-primary-700"
                    >
                      {item.kind === "measurement_sheet"
                        ? "פתח את הדוח שנשלח ←"
                        : "פתיחת הדוח ←"}
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => void approve(item)}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {busy ? "מאשר…" : "אשר"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => {
                      setRejectId(item.documentId);
                      setRejectKind(item.kind);
                      setComment("");
                      setError("");
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    החזר לתיקון
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
                disabled={!!busyId}
                onClick={() => void reject()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyId?.startsWith("reject-")
                  ? "שולח…"
                  : "שלח חזרה למנהל העבודה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendSheetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="text-lg font-bold">שליחת קישור ללקוח לחתימה</h3>
            <p className="text-sm text-gray-500">
              הלקוח יראה את נתוני הדוח שאושר ויוכל לרשום חתימה
            </p>
            <label className="block text-sm">
              טלפון לקוח (אופציונלי)
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
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
                  onClick={() =>
                    void navigator.clipboard.writeText(sendResult.url)
                  }
                >
                  העתק קישור
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSendSheetId(null);
                  setSendResult(null);
                }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold"
              >
                סגור
              </button>
              {!sendResult && (
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void sendClientLink()}
                  className="flex-1 rounded-xl bg-amber-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busyId?.startsWith("send-") ? "יוצר…" : "צור קישור"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
