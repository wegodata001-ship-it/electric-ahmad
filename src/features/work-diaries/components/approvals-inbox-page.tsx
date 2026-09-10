"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  Eye,
  FileWarning,
  Pencil,
  X,
} from "lucide-react";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { cn } from "@/lib/utils";

function portalBase(pathname: string) {
  if (pathname.startsWith("/project")) return "/project";
  if (pathname.startsWith("/field")) return "/field";
  if (pathname.startsWith("/system")) return "/system";
  return "/operations";
}

function accountsPath(base: string, fixHref: string) {
  // fixHref starts with ?projectId=...
  if (base === "/field") {
    // Field: open performance via invoices-style not available — use review edit
    const q = new URLSearchParams(fixHref.replace(/^\?/, ""));
    const sheetId = q.get("sheetId");
    return sheetId
      ? `/field/approvals/review/measurement_sheet/${sheetId}?mode=edit`
      : "/field/approvals";
  }
  return `${base}/accounts${fixHref.startsWith("?") ? fixHref : `?${fixHref}`}`;
}

/**
 * מרכז תיקונים — מסמכים שחזרו לתיקון + פתיחה ישירה לעריכה.
 * סעיף משני: ממתינים לאישור שלי (any_one).
 */
export function ApprovalsInboxPage() {
  const pathname = usePathname();
  const router = useRouter();
  const base = portalBase(pathname);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState<"fixes" | "pending">("fixes");

  function reload() {
    return Promise.all([
      approvalsService.revisions().catch(() => ({ items: [] as any[] })),
      approvalsService.pending().catch(() => ({ items: [] as any[] })),
    ]).then(([rev, pen]) => {
      setRevisions(rev.items || []);
      setPending(pen.items || []);
      if ((rev.items || []).length === 0 && (pen.items || []).length > 0) {
        setTab("pending");
      }
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pendingSheets = useMemo(
    () => pending.filter((i) => i.kind === "measurement_sheet"),
    [pending]
  );
  const pendingOther = useMemo(
    () => pending.filter((i) => i.kind !== "measurement_sheet"),
    [pending]
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
      setPending((prev: any[]) =>
        prev.filter((p) => p.documentId !== item.documentId)
      );
      void reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה באישור");
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejectFor) return;
    if (!rejectReason.trim()) {
      setError("חובה להזין הערת תיקון");
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
      const rejected = rejectFor;
      setPending((prev: any[]) =>
        prev.filter((p) => p.documentId !== rejected.documentId)
      );
      setRejectFor(null);
      setRejectReason("");
      setTab("fixes");
      setBusyId(null);
      void reload();
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בהחזרה לתיקון");
    } finally {
      setBusyId(null);
    }
  }

  function openFix(item: any) {
    const href = accountsPath(base, item.fixHref || "");
    router.push(href);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-0 sm:p-6" dir="rtl">
      <div className="rounded-3xl bg-slate-900 px-5 py-6 text-white shadow-sm">
        <p className="text-sm font-bold text-orange-300">מרכז תיקונים</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          תיקונים ({revisions.length})
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          מסמכים שהוחזרו לתיקון — פתחו לעריכה, תקנו, ושלחו מחדש לאישור.
          מספיק שאישור אחד יאשר את הגרסה החדשה.
        </p>
      </div>

      <div className="flex gap-2">
        <TabBtn
          active={tab === "fixes"}
          onClick={() => setTab("fixes")}
          label={`דורשים תיקון (${revisions.length})`}
        />
        <TabBtn
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          label={`ממתינים לאישורי (${pending.length})`}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">טוען…</p>}

      {!loading && tab === "fixes" && !revisions.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          אין מסמכים שממתינים לתיקון
        </div>
      )}

      {!loading && tab === "fixes" && revisions.length > 0 && (
        <section className="space-y-3">
          {revisions.map((item) => (
            <FixCard
              key={`${item.kind}-${item.documentId}`}
              item={item}
              onOpen={() => openFix(item)}
            />
          ))}
        </section>
      )}

      {!loading && tab === "pending" && !pending.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          אין מסמכים שממתינים לאישורך
        </div>
      )}

      {!loading && tab === "pending" && (
        <div className="space-y-6">
          {pendingSheets.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">
                דפי מדידה ({pendingSheets.length})
              </h2>
              {pendingSheets.map((item) => (
                <PendingCard
                  key={item.approvalId}
                  busy={busyId === item.approvalId}
                  title={item.documentNumber || item.title}
                  subtitle={`${item.projectName || "פרויקט"} · V${item.version || 1}`}
                  meta={item.createdByName || ""}
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
            </section>
          )}
          {pendingOther.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">
                מסמכים נוספים ({pendingOther.length})
              </h2>
              {pendingOther.map((item) => (
                <PendingCard
                  key={item.approvalId}
                  busy={busyId === item.approvalId}
                  title={item.documentNumber || item.title}
                  subtitle={`${item.projectName || item.project?.name || "פרויקט"}`}
                  meta={item.foremanName || ""}
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
            </section>
          )}
        </div>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black">החזרה לתיקון</h2>
            <p className="text-sm text-slate-500">
              {rejectFor.documentNumber} — המסמך ייכנס מיד למרכז תיקונים
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="מה צריך לתקן?"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
            <button
              type="button"
              disabled={busyId === rejectFor.approvalId}
              onClick={() => void reject()}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-orange-600 text-base font-black text-white"
            >
              החזר לתיקון
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

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function FixCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-800">
          <FileWarning className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-black text-slate-900">
              {item.documentNumber}
            </p>
            <span className="rounded-lg bg-orange-600 px-2.5 py-0.5 text-[11px] font-black text-white">
              נדרש תיקון
              {item.version ? ` · V${item.version}` : ""}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {item.title}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {item.projectName || "פרויקט"}
            {item.clientName ? ` · ${item.clientName}` : ""}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            החזיר:{" "}
            <span className="font-bold text-slate-800">
              {item.returnedByName || "—"}
            </span>
            {item.returnedAt
              ? ` · ${new Date(item.returnedAt).toLocaleString("he-IL")}`
              : ""}
            {item.waitingLabel ? ` · ממתין ${item.waitingLabel}` : ""}
          </p>
          {item.returnComment && (
            <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-950">
              <p className="text-[11px] font-bold text-orange-700">הערת תיקון</p>
              <p className="mt-0.5 whitespace-pre-wrap">{item.returnComment}</p>
            </div>
          )}
          {!!item.reviewNotes?.length && (
            <ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-slate-600">
              {item.reviewNotes.map((n: any, i: number) => (
                <li key={i}>
                  {n.comment}
                  {n.authorName ? ` — ${n.authorName}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-orange-700"
      >
        <Pencil className="h-4 w-4" />
        עריכה · תקן דף
      </button>
    </div>
  );
}

function PendingCard({
  title,
  subtitle,
  meta,
  busy,
  onApprove,
  onReject,
  onOpen,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-sm">
      <p className="truncate text-lg font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      {meta && <p className="mt-1 text-xs text-slate-400">{meta}</p>}
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
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-orange-600 text-sm font-black text-white"
        >
          <X className="h-4 w-4" />
          לתיקון
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-black text-white"
        >
          <Eye className="h-4 w-4" />
          פתח
        </button>
      </div>
    </div>
  );
}
