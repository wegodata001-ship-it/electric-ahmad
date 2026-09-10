"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { formatNumber } from "@/utils/format";
import { fetchClientMe } from "@/lib/auth/client-me";
import {
  isSystemAdminRole,
} from "@/lib/auth/document-permissions";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";
import { ManualCorrectionEditor } from "./manual-correction-editor";

type Kind = "work_diary" | "delivery_note" | "measurement_sheet";

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

export function ApprovalReviewPage({
  kind,
  documentId,
  backHref = "/operations/approvals",
}: {
  kind: Kind;
  documentId: string;
  backHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = portalBase(pathname);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<{ userId?: string; role?: string } | null>(
    null
  );

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectStep, setRejectStep] = useState<"choice" | "note">("choice");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectFiles, setRejectFiles] = useState<
    { name: string; url: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [manualEdit, setManualEdit] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [optSaveDocs, setOptSaveDocs] = useState(true);
  const [optNotify, setOptNotify] = useState(true);
  const [optSendClient, setOptSendClient] = useState(false);

  const [convText, setConvText] = useState("");

  function reload() {
    return approvalsService
      .review(kind, documentId)
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, documentId]);

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => {
        if (!json.success) return;
        setMe({
          userId: String(json.data?.id || ""),
          role: json.data?.role,
        });
      })
      .catch(() => setMe(null));
  }, []);

  const doc = data?.document;
  const pending =
    doc?.status === "pending_approval" || doc?.status === "in_approval";
  const isRevision = doc?.status === "revision";
  const isApproved =
    doc?.status === "approved" ||
    doc?.status === "locked" ||
    doc?.status === "invoiced";

  const canPmEditPage = useMemo(() => {
    if (kind !== "measurement_sheet" || !pending || !doc?.projectId) return false;
    if (data?.canPmEdit || doc?.pmApprovalEdit) return true;
    if (me?.role !== PROJECT_MANAGER_ROLE || !me.userId) return false;
    const approvals = doc.approvals ?? [];
    return approvals.some(
      (a: any) =>
        a.status === "pending" &&
        (a.approverId === me.userId || a.approver?.id === me.userId)
    );
  }, [kind, pending, doc, me, data]);

  const pmEditHref =
    canPmEditPage && doc?.projectId
      ? `${base}/accounts?projectId=${doc.projectId}&module=performance&sheetId=${documentId}&pmEdit=1`
      : null;

  const approvedBy = useMemo(() => {
    const rows = doc?.approvals ?? [];
    return rows.find((a: any) => a.status === "approved");
  }, [doc]);
  const rejectedBy = useMemo(() => {
    const rows = doc?.approvals ?? [];
    return rows.find((a: any) => a.status === "rejected");
  }, [doc]);

  const sections = useMemo(() => {
    if (kind !== "measurement_sheet" || !doc) return [];
    const map = new Map<string, any>();
    for (const c of doc.cells ?? []) {
      if (c.boqItem) map.set(c.boqItemId, c.boqItem);
    }
    return [...map.values()].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "he")
    );
  }, [doc, kind]);

  function qty(rowId: string, boqId: string) {
    const cell = (doc?.cells ?? []).find(
      (c: any) => c.rowId === rowId && c.boqItemId === boqId
    );
    return Number(cell?.quantity ?? 0);
  }

  async function uploadRejectFile(file: File) {
    if (!doc?.projectId && !doc?.project?.id) {
      setError("אין פרויקט להעלאת קובץ");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", doc.projectId || doc.project.id);
      form.append("folderPath", "תיקונים / הערות מאשר");
      form.append("title", `תיקון — ${file.name}`);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "שגיאת העלאה");
      const url = json.data?.url || json.data?.document?.url;
      if (!url) throw new Error("לא התקבל קישור לקובץ");
      setRejectFiles((prev) => [...prev, { name: file.name, url }]);
    } catch (e: any) {
      setError(e.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  async function confirmApprove() {
    setBusy(true);
    setError("");
    try {
      const result = (await approvalsService.decide({
        kind,
        documentId,
        decision: "approved",
        approveOptions: {
          saveToDocuments: optSaveDocs,
          notifyCreator: optNotify,
          sendToClient: optSendClient,
        },
      })) as any;

      const stillWaiting =
        result?.awaitingOtherApprovers ||
        result?.approvalComplete === false ||
        ((result?.status === "pending_approval" ||
          result?.status === "in_approval") &&
          result?.approvalComplete !== true);

      if (stillWaiting) {
        setInfo("האישור נרשם — ממתין למאשרים נוספים");
        setApproveOpen(false);
        setData((prev: any) =>
          prev ? { ...prev, ...result, status: result?.status ?? prev.status } : prev
        );
      } else {
        setInfo("המסמך אושר (מספיק אישור אחד)");
        setApproveOpen(false);
        setData((prev: any) =>
          prev ? { ...prev, ...result, status: result?.status ?? "approved" } : prev
        );
        setBusy(false);
        router.replace(backHref);
        return;
      }
    } catch (e: any) {
      setError(e.message || "שגיאה באישור");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejectNotes.trim()) {
      setError("חובה לרשום הערות להחזרה");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await approvalsService.decide({
        kind,
        documentId,
        decision: "rejected",
        correctionMode: "note",
        comment: rejectNotes.trim(),
        rejectAttachments: rejectFiles.map((f) => f.url),
      });
      setRejectOpen(false);
      setData((prev: any) =>
        prev
          ? { ...prev, ...(result as any), status: (result as any)?.status ?? "revision" }
          : prev
      );
      setBusy(false);
      router.replace(backHref);
      return;
    } catch (e: any) {
      setError(e.message || "שגיאה בהחזרה");
    } finally {
      setBusy(false);
    }
  }

  async function startManualCorrection() {
    setBusy(true);
    setError("");
    try {
      await approvalsService.decide({
        kind,
        documentId,
        decision: "rejected",
        correctionMode: "manual",
      });
      setRejectOpen(false);
      if (kind === "measurement_sheet" && doc?.projectId) {
        router.push(
          `${base}/accounts?projectId=${doc.projectId}&module=performance&sheetId=${documentId}&correction=1`
        );
        return;
      }
      await reload();
      setManualEdit(true);
    } catch (e: any) {
      setError(e.message || "לא ניתן לפתוח תיקון ידני");
    } finally {
      setBusy(false);
    }
  }

  async function resubmitManualCorrection() {
    const approvals = doc?.approvals || [];
    const latestSentAt = Math.max(
      ...approvals.map((approval: any) =>
        new Date(approval.sentAt || approval.createdAt || 0).getTime()
      )
    );
    const approverIds = [
      ...new Set(
        approvals
          .filter(
            (approval: any) =>
              latestSentAt -
                new Date(
                  approval.sentAt || approval.createdAt || 0
                ).getTime() <
              5_000
          )
          .map(
            (approval: any) =>
              approval.approverId || approval.approver?.id
          )
          .filter(Boolean)
      ),
    ] as string[];
    if (!approverIds.length) {
      throw new Error("לא נמצאו מאשרים מהסבב הקודם");
    }
    const endpoint =
      kind === "work_diary"
        ? `/api/work-diaries/${documentId}/submit`
        : `/api/ops-delivery-notes/${documentId}/submit`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverIds }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || "השליחה מחדש נכשלה");
    }
    setInfo("התיקון נשלח מחדש לאישור");
    setManualEdit(false);
    router.replace(backHref);
  }

  async function sendConversation() {
    if (!data?.workflowDocumentId || !convText.trim()) return;
    setBusy(true);
    try {
      await fetch(
        `/api/workflow/documents/${data.workflowDocumentId}/conversation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: convText.trim() }),
        }
      );
      setConvText("");
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-stone-400">טוען מסמך לאישור…</p>;
  }

  if (!doc) {
    return (
      <div className="space-y-3">
        <Link href={backHref} className="text-sm font-bold text-amber-800">
          ← חזרה לתיבת אישורים
        </Link>
        <p className="text-red-600">{error || "מסמך לא נמצא"}</p>
      </div>
    );
  }

  const number =
    doc.documentNumber || doc.title || `MS-${doc.sequenceNumber || ""}`;
  const projectName = doc.project?.name || doc.projectName || "—";
  const clientName =
    doc.clientName || doc.project?.contractor || "—";
  const creator =
    doc.createdByName ||
    doc.foreman?.name ||
    doc.createdBy?.name ||
    "—";

  const sentTo = (doc.approvals || [])
    .map((a: any) => a.approver?.name || a.approverName)
    .filter(Boolean)
    .join(" · ");

  const relatedDocs = data.related?.documents || [];
  const relatedByKind = {
    measurement: relatedDocs.filter((d: any) =>
      String(d.sourceType || "").includes("measurement")
    ),
    invoice: relatedDocs.filter((d: any) => {
      const s = String(d.sourceType || "");
      return s.includes("invoice") || s.includes("account");
    }),
    delivery: relatedDocs.filter((d: any) =>
      String(d.sourceType || "").includes("delivery")
    ),
    diary: relatedDocs.filter((d: any) => {
      const s = String(d.sourceType || "");
      return s.includes("work_diary") || s.includes("diary");
    }),
    other: relatedDocs.filter((d: any) => {
      const s = String(d.sourceType || "");
      return (
        !s.includes("measurement") &&
        !s.includes("invoice") &&
        !s.includes("account") &&
        !s.includes("delivery") &&
        !s.includes("work_diary") &&
        !s.includes("diary")
      );
    }),
  };

  return (
    <div className="space-y-4 pb-28" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-bold text-amber-800"
        >
          <ArrowRight className="h-4 w-4" />
          תיקונים
        </Link>
        {pending && (
          <div className="flex flex-wrap gap-2">
            {pmEditHref && (
              <Link
                href={pmEditHref}
                className="inline-flex min-h-12 items-center gap-1 rounded-2xl border border-sky-300 bg-sky-50 px-5 font-black text-sky-900"
              >
                <Pencil className="h-5 w-5" />
                עריכת דף
              </Link>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRejectStep("choice");
                setRejectOpen(true);
                setError("");
              }}
              className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-red-50 px-5 font-black text-red-700"
            >
              <X className="h-5 w-5" />
              {busy ? "מחזיר לתיקון..." : "החזר לתיקון"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setApproveOpen(true)}
              className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-emerald-600 px-5 font-black text-white"
            >
              <Check className="h-5 w-5" />
              {busy ? "מאשר..." : "אשר"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {info}
        </p>
      )}

      {manualEdit &&
        isRevision &&
        (kind === "work_diary" || kind === "delivery_note") && (
          <ManualCorrectionEditor
            kind={kind}
            document={doc}
            onSaved={reload}
            onResubmit={resubmitManualCorrection}
          />
        )}

      {isApproved && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>
            המסמך כבר אושר
            {approvedBy?.approver?.name || approvedBy?.approverName
              ? ` על ידי ${approvedBy.approver?.name || approvedBy.approverName}`
              : ""}
            {approvedBy?.decidedAt
              ? ` ב־${new Date(approvedBy.decidedAt).toLocaleString("he-IL")}`
              : doc.approvedAt
                ? ` ב־${new Date(doc.approvedAt).toLocaleString("he-IL")}`
                : ""}
            . אין צורך באישור נוסף.
          </p>
          {kind === "measurement_sheet" && doc?.projectId && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/system/accounts?projectId=${doc.projectId}&module=performance&sheetId=${documentId}`}
                className="inline-flex min-h-10 items-center rounded-xl bg-emerald-700 px-4 text-xs font-black text-white"
              >
                הפק חשבון / שלח ללקוח
              </Link>
              <a
                href={`/print/measurement-sheets/${documentId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-xl border border-emerald-300 bg-white px-4 text-xs font-bold text-emerald-900"
              >
                PDF
              </a>
            </div>
          )}
        </div>
      )}

      {isRevision && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          המסמך הוחזר לתיקון
          {rejectedBy?.approver?.name || rejectedBy?.approverName
            ? ` על ידי ${rejectedBy.approver?.name || rejectedBy.approverName}`
            : ""}
          {doc.lastReturnComment ? `: ${doc.lastReturnComment}` : ""}. לא ניתן
          לאשר גרסה זו — יש לתקן ולשלוח מחדש.
        </div>
      )}

      {/* Header */}
      <header className="rounded-3xl border-2 border-amber-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold text-amber-700">{kindLabel(kind)}</p>
        <h1 className="mt-1 text-2xl font-black text-stone-900">{number}</h1>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <Meta label="פרויקט" value={projectName} />
          <Meta label="לקוח" value={clientName} />
          <Meta label="יוצר" value={creator} />
          <Meta
            label="תאריך"
            value={doc.workDate || doc.noteDate || doc.createdAt || "—"}
          />
          <Meta label="סטטוס" value={doc.statusLabel || doc.status} />
          <Meta label="למי נשלח" value={sentTo || "—"} />
          <Meta
            label="מנהל עבודה"
            value={doc.foreman?.name || doc.foremanName || "—"}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Body */}
          <Section title="תוכן המסמך">
            {kind === "work_diary" && (
              <>
                {doc.workSummary && (
                  <p className="mb-3 whitespace-pre-wrap text-sm">
                    {doc.workSummary}
                  </p>
                )}
                {doc.notes && (
                  <p className="mb-3 whitespace-pre-wrap text-sm text-stone-600">
                    הערות: {doc.notes}
                  </p>
                )}
                <Sub title="עובדים">
                  {(doc.workers || []).length
                    ? (doc.workers || [])
                        .map(
                          (w: any) =>
                            `${w.name}${w.hours ? ` (${w.hours}ש׳)` : ""}`
                        )
                        .join(" · ")
                    : "—"}
                </Sub>
                <Sub title="פריטי עבודה">
                  <ul className="space-y-1">
                    {(doc.workItems || []).map((i: any) => (
                      <li key={i.id} className="flex justify-between text-sm">
                        <span>{i.description}</span>
                        <span className="text-stone-500">
                          {i.quantity} {i.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Sub>
                <Sub title="ציוד">
                  {(doc.equipment || [])
                    .map((e: any) => e.name)
                    .join(" · ") || "—"}
                </Sub>
                <Sub title="חומרים">
                  {(doc.materials || [])
                    .map((m: any) => `${m.name} (${m.quantity})`)
                    .join(" · ") || "—"}
                </Sub>
                {!!doc.media?.length && (
                  <Sub title="תמונות">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {doc.media.map((m: any) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={m.id || m.url}
                          src={m.url}
                          alt={m.name}
                          className="h-28 w-full rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  </Sub>
                )}
              </>
            )}

            {kind === "delivery_note" && (
              <>
                {doc.notes && (
                  <p className="mb-3 whitespace-pre-wrap text-sm">{doc.notes}</p>
                )}
                <ul className="space-y-2">
                  {(doc.items || []).map((i: any) => (
                    <li
                      key={i.id}
                      className="flex justify-between border-b border-stone-100 py-2 text-sm"
                    >
                      <span>{i.description}</span>
                      <span>
                        {i.quantity} {i.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                {!!doc.media?.length && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {doc.media.map((m: any) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.id || m.url}
                        src={m.url}
                        alt=""
                        className="h-28 w-full rounded-xl object-cover"
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {kind === "measurement_sheet" && (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-stone-900 text-white">
                    <tr>
                      <th className="px-2 py-2 text-right">חדר</th>
                      {sections.map((s: any) => (
                        <th key={s.id} className="px-1 py-2 whitespace-nowrap">
                          {s.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(doc.rows || []).map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                        {sections.map((s: any) => (
                          <td key={s.id} className="px-1 py-1.5 text-center">
                            {formatNumber(qty(r.id, s.id)) || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            {(data.timeline || []).length === 0 ? (
              <p className="text-sm text-stone-400">אין היסטוריה</p>
            ) : (
              <ol className="space-y-2 border-r-2 border-amber-200 pr-4">
                {(data.timeline || []).map((t: any) => (
                  <li key={t.id || t.createdAt} className="text-sm">
                    <p className="font-bold">
                      {t.message || t.action || t.label}
                    </p>
                    <p className="text-xs text-stone-400">
                      {[t.actorName, t.createdAt
                        ? new Date(t.createdAt).toLocaleString("he-IL")
                        : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Conversation */}
          <Section title="Conversation">
            <div className="mb-3 space-y-2">
              {(data.conversation || []).length === 0 && (
                <p className="text-sm text-stone-400">אין הודעות עדיין</p>
              )}
              {(data.conversation || []).map((m: any) => (
                <div
                  key={m.id}
                  className="rounded-2xl bg-stone-50 px-3 py-2 text-sm"
                >
                  <p className="text-xs font-bold text-stone-500">
                    {m.actorName || m.authorName || "משתמש"}
                    {m.createdAt
                      ? ` · ${new Date(m.createdAt).toLocaleString("he-IL")}`
                      : ""}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">
                    {m.body || m.message || m.text}
                  </p>
                </div>
              ))}
            </div>
            {data.workflowDocumentId && (
              <div className="flex gap-2">
                <input
                  value={convText}
                  onChange={(e) => setConvText(e.target.value)}
                  placeholder="כתבו הודעה על המסמך…"
                  className="min-h-11 flex-1 rounded-xl border border-stone-200 px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !convText.trim()}
                  onClick={() => void sendConversation()}
                  className="rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* Related sidebar */}
        <aside className="space-y-3">
          <Section title="מסמכים קשורים">
            <RelatedGroup
              title="דף מדידה"
              items={relatedByKind.measurement}
            />
            <RelatedGroup title="חשבון" items={relatedByKind.invoice} />
            <RelatedGroup
              title="תעודת משלוח"
              items={relatedByKind.delivery}
            />
            <RelatedGroup title="יומן עבודה" items={relatedByKind.diary} />
            <RelatedGroup title="קבצים מצורפים" items={relatedByKind.other} />
            {!relatedDocs.length && (
              <p className="text-sm text-stone-400">אין מסמכים נוספים</p>
            )}
          </Section>
          {(data.related?.photos || []).length > 0 && (
            <Section title="תמונות בפרויקט">
              <div className="grid grid-cols-2 gap-1">
                {(data.related.photos as any[]).slice(0, 8).map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-20 w-full rounded-lg object-cover"
                    />
                  </a>
                ))}
              </div>
            </Section>
          )}
          {kind === "measurement_sheet" && (
            <a
              href={`/print/measurement-sheets/${documentId}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white text-sm font-bold"
            >
              <Download className="h-4 w-4" />
              פתח PDF / הדפסה
            </a>
          )}
        </aside>
      </div>

      {/* Sticky action bar mobile */}
      {pending && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-white/95 p-3 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            {pmEditHref && (
              <Link
                href={pmEditHref}
                className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-sky-300 bg-sky-50 font-black text-sky-900"
              >
                <Pencil className="h-4 w-4" />
                עריכה
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setRejectStep("choice");
                setRejectOpen(true);
              }}
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-red-50 font-black text-red-700"
            >
              תיקון
            </button>
            <button
              type="button"
              onClick={() => setApproveOpen(true)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-emerald-600 font-black text-white"
            >
              אשר
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectOpen && (
        <Modal title="החזרה לתיקון" onClose={() => setRejectOpen(false)}>
          {rejectStep === "choice" ? (
            <>
              <p className="mb-4 text-sm text-stone-600">
                איך תרצה לבצע את התיקון?
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startManualCorrection()}
                  className="flex w-full items-start gap-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 text-right"
                >
                  <Pencil className="mt-0.5 h-5 w-5 text-sky-800" />
                  <span>
                    <span className="block font-black text-sky-950">
                      תיקון ידני
                    </span>
                    <span className="mt-1 block text-sm text-sky-800">
                      פתיחת המסמך המקורי לעריכה ותיקון הנתונים ישירות.
                    </span>
                  </span>
                  {busy && (
                    <Loader2 className="mr-auto h-5 w-5 animate-spin" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectStep("note")}
                  className="flex w-full items-start gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-right"
                >
                  <MessageSquare className="mt-0.5 h-5 w-5 text-amber-800" />
                  <span>
                    <span className="block font-black text-amber-950">
                      תיקון לפי הערה
                    </span>
                    <span className="mt-1 block text-sm text-amber-800">
                      כתיבת הערה ליוצר המסמך, שיתקן וישלח מחדש.
                    </span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="mt-4 w-full rounded-xl border py-3 text-sm font-bold"
              >
                ביטול
              </button>
            </>
          ) : (
            <>
              <label className="mb-3 block text-sm">
                <span className="font-bold">הערה לתיקון *</span>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  placeholder="לדוגמה: יש לתקן את הכמות בסעיף 3 מ־10 ל־12"
                />
              </label>
              <div className="mb-4">
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 text-sm font-bold text-stone-600">
                  <Paperclip className="h-4 w-4" />
                  {uploading ? "מעלה…" : "צרף קובץ / תמונה / PDF"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadRejectFile(f);
                    }}
                  />
                </label>
                <ul className="mt-2 space-y-1 text-xs text-stone-600">
                  {rejectFiles.map((f) => (
                    <li key={f.url}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectStep("choice")}
                  className="flex-1 rounded-xl border py-3 text-sm font-bold"
                >
                  חזרה
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmReject()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "מחזיר לתיקון..." : "החזר לתיקון"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Approve confirm */}
      {approveOpen && (
        <Modal title="לאשר מסמך זה?" onClose={() => setApproveOpen(false)}>
          <div className="mb-4 space-y-1 text-sm">
            <p>
              <span className="text-stone-400">סוג: </span>
              {kindLabel(kind)}
            </p>
            <p>
              <span className="text-stone-400">מספר: </span>
              {number}
            </p>
            <p>
              <span className="text-stone-400">פרויקט: </span>
              {projectName}
            </p>
          </div>
          <div className="mb-4 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optSaveDocs}
                onChange={(e) => setOptSaveDocs(e.target.checked)}
              />
              לשמור גרסה מאושרת במסמכים
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optNotify}
                onChange={(e) => setOptNotify(e.target.checked)}
              />
              לשלוח הודעה ליוצר המסמך
            </label>
            {isSystemAdminRole(me?.role) && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optSendClient}
                  onChange={(e) => setOptSendClient(e.target.checked)}
                />
                לשלוח ללקוח לחתימה
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setApproveOpen(false)}
              className="flex-1 rounded-xl border py-3 text-sm font-bold"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmApprove()}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {busy ? "מאשר..." : "אשר"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-stone-400">{label}: </span>
      <span className="font-semibold">{String(value)}</span>
    </p>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-black">{title}</h2>
      {children}
    </section>
  );
}

function Sub({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-bold text-stone-400">{title}</p>
      <div className="text-sm text-stone-800">{children}</div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">{title}</h3>
          <button type="button" onClick={onClose} className="text-stone-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RelatedGroup({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; url?: string | null; sourceType?: string | null }[];
}) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-bold text-stone-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((d) => (
          <li key={d.id}>
            {d.url ? (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold hover:bg-stone-50"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span className="text-xs font-normal text-stone-600">
                  {d.name}
                </span>
              </a>
            ) : (
              <span className="block text-xs text-stone-600">{d.name}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
