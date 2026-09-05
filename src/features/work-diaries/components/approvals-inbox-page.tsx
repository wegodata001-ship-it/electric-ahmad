"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Eye, FileText, X } from "lucide-react";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { cn } from "@/lib/utils";

function kindLabel(kind: string) {
  if (kind === "work_diary") return "יומן עבודה";
  if (kind === "delivery_note") return "תעודת משלוח";
  if (kind === "measurement_sheet") return "דף מדידה";
  return kind;
}

function portalBase(pathname: string) {
  if (pathname.startsWith("/project")) return "/project";
  if (pathname.startsWith("/field")) return "/field";
  if (pathname.startsWith("/system")) return "/system";
  return "/operations";
}

/**
 * Unified approvals center for System / Ops / Project managers.
 */
export function ApprovalsInboxPage() {
  const pathname = usePathname();
  const router = useRouter();
  const base = portalBase(pathname);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function reload() {
    return approvalsService
      .pending()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const diaries = useMemo(
    () => items.filter((i) => i.kind === "work_diary"),
    [items]
  );
  const notes = useMemo(
    () => items.filter((i) => i.kind === "delivery_note"),
    [items]
  );
  const other = useMemo(
    () =>
      items.filter(
        (i) => i.kind !== "work_diary" && i.kind !== "delivery_note"
      ),
    [items]
  );

  async function approve(item: any) {
    setBusyId(item.approvalId);
    setError("");
    try {
      await approvalsService.decide({
        kind: item.kind,
        documentId: item.documentId,
        decision: "approved",
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה באישור");
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejectFor) return;
    if (!rejectReason.trim()) {
      setError("חובה להזין סיבת דחייה");
      return;
    }
    setBusyId(rejectFor.approvalId);
    setError("");
    try {
      await approvalsService.decide({
        kind: rejectFor.kind,
        documentId: rejectFor.documentId,
        decision: "rejected",
        comment: rejectReason.trim(),
      });
      setRejectFor(null);
      setRejectReason("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בדחייה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-0 sm:p-6" dir="rtl">
      <div className="rounded-3xl bg-slate-900 px-5 py-6 text-white shadow-sm">
        <p className="text-sm font-bold text-amber-300">מרכז אישורים</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          🔔 ממתין לאישור ({items.length})
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          מספיק שאישור אחד יאשר — שאר הבקשות נסגרות אוטומטית
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

      {diaries.length > 0 && (
        <Section title={`יומני עבודה (${diaries.length})`}>
          {diaries.map((item) => (
            <Card
              key={item.approvalId}
              busy={busyId === item.approvalId}
              title={item.documentNumber}
              subtitle={`${item.projectName || "פרויקט"} · ${item.foremanName || ""}`}
              meta={
                item.workDate
                  ? new Date(item.workDate).toLocaleDateString("he-IL")
                  : ""
              }
              summary={item.workSummary}
              badge={
                item.photoCount
                  ? `${item.photoCount} תמונות`
                  : undefined
              }
              onApprove={() => void approve(item)}
              onReject={() => {
                setRejectFor(item);
                setRejectReason("");
              }}
              onOpen={() =>
                router.push(
                  `${base}/approvals/review/${item.kind}/${item.documentId}`
                )
              }
            />
          ))}
        </Section>
      )}

      {notes.length > 0 && (
        <Section title={`תעודות משלוח (${notes.length})`}>
          {notes.map((item) => (
            <Card
              key={item.approvalId}
              busy={busyId === item.approvalId}
              title={item.documentNumber}
              subtitle={`${item.projectName || item.project?.name || "פרויקט"} · יעד: ${item.destination || "—"}`}
              meta={`${item.foremanName || ""} · ${
                item.workDate
                  ? new Date(item.workDate).toLocaleDateString("he-IL")
                  : ""
              }`}
              summary={item.notes}
              onApprove={() => void approve(item)}
              onReject={() => {
                setRejectFor(item);
                setRejectReason("");
              }}
              onOpen={() =>
                router.push(
                  `${base}/approvals/review/${item.kind}/${item.documentId}`
                )
              }
              openLabel="הצג תעודה"
            />
          ))}
        </Section>
      )}

      {other.length > 0 && (
        <Section title={`מסמכים נוספים (${other.length})`}>
          {other.map((item) => (
            <Link
              key={item.approvalId}
              href={`${base}/approvals/review/${item.kind}/${item.documentId}`}
              className="block rounded-2xl border-2 border-amber-200 bg-white p-4"
            >
              <p className="text-xs font-bold text-amber-700">
                {kindLabel(item.kind)}
              </p>
              <p className="text-lg font-black">
                {item.documentNumber || item.title}
              </p>
            </Link>
          ))}
        </Section>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black">דחייה / החזרה לתיקון</h2>
            <p className="text-sm text-slate-500">
              {rejectFor.documentNumber} — חובה לציין סיבה
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="סיבת הדחייה"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
            <button
              type="button"
              disabled={busyId === rejectFor.approvalId}
              onClick={() => void reject()}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-red-600 text-base font-black text-white"
            >
              שלח דחייה
            </button>
            <button
              type="button"
              onClick={() => setRejectFor(null)}
              className="flex min-h-12 w-full items-center justify-center text-base font-bold text-slate-600"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Card({
  title,
  subtitle,
  meta,
  summary,
  badge,
  busy,
  onApprove,
  onReject,
  onOpen,
  openLabel = "פתח לקריאה מלאה",
}: {
  title: string;
  subtitle: string;
  meta?: string;
  summary?: string | null;
  badge?: string;
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
  openLabel?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
          <FileText className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          {meta && <p className="mt-1 text-xs text-slate-400">{meta}</p>}
          {summary && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-700">{summary}</p>
          )}
          {badge && (
            <span className="mt-2 inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className={cn(
            "flex min-h-12 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-sm font-black text-white",
            busy && "opacity-60"
          )}
        >
          <Check className="h-4 w-4" />
          אשר
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-red-600 text-sm font-black text-white"
        >
          <X className="h-4 w-4" />
          דחה
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-black text-white"
        >
          <Eye className="h-4 w-4" />
          {openLabel.includes("תעודה") ? "הצג" : "פתח"}
        </button>
      </div>
    </div>
  );
}
