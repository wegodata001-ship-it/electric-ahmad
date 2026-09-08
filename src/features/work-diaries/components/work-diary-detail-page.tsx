"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, Send, X } from "lucide-react";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import { workDiariesService } from "../services/work-diaries.service";
import { COMPANY_PROFILE } from "@/config/company";
import { approvalStatusLabel } from "@/lib/workflow/approval-status-labels";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "דורש תיקון",
  pending_approval: "ממתין לאישור",
  in_approval: "ממתין לאישור",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  client_signed: "נחתם ע״י לקוח",
  signed: "נחתם ע״י לקוח",
  completed: "נעול",
  locked: "נעול",
  used_for_measurement: "שימש למדידה",
  used_for_account: "שימש לחשבון",
  used_for_invoice: "שימש לחשבונית",
};

export function WorkDiaryDetailPage({ id }: { id: string }) {
  const [diary, setDiary] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [approvers, setApprovers] = useState<{ id: string; name: string; roleLabel: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    return workDiariesService
      .get(id)
      .then(setDiary)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [id]);

  async function openSubmit() {
    setShowSubmit(true);
    try {
      const r = await workDiariesService.listApprovers();
      setApprovers(r.items);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submit() {
    if (!selected.length) {
      setError("יש לבחור לפחות מאשר אחד");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await workDiariesService.submit(id, selected);
      setDiary(updated);
      setShowSubmit(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">טוען…</p>;
  if (!diary) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600">יומן העבודה לא נמצא</p>
        <Link href="/field/work-diaries" className="text-[#1e40af] text-sm font-semibold mt-3 inline-block">
          חזרה ליומן עבודה
        </Link>
      </div>
    );
  }

  const editable = diary.status === "draft" || diary.status === "revision";

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start gap-3">
        <Link href="/field/work-diaries" className="text-gray-500 mt-1">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {COMPANY_PROFILE.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={COMPANY_PROFILE.logoUrl} alt="" className="h-10 w-auto object-contain" />
            ) : null}
            <div>
              <h1 className="text-xl font-bold text-[#03142F]">{diary.documentNumber}</h1>
              <p className="text-sm text-gray-500">
                {STATUS_LABEL[diary.status] ?? diary.status} · {diary.workDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {diary.status === "revision" && (
        <RevisionFeedbackBanner
          comment={diary.rejectionComment || diary.revisionComment}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/print/work-diaries/${id}?download=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-[#1e40af] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e40af]"
        >
          <Download className="h-4 w-4" />
          הורדת PDF
        </Link>
        {editable && (
          <>
            <Link
              href={`/field/work-diaries/${id}/edit`}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold"
            >
              עריכה
            </Link>
            <button
              type="button"
              onClick={openSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Send className="h-4 w-4" />
              שלח לאישור
            </button>
          </>
        )}
        {!editable && (
          <p className="text-sm text-gray-500">
            המסמך נעול לעריכה עד החזרה לתיקון או השלמת התהליך
          </p>
        )}
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2 text-sm">
        <h2 className="font-bold text-[#03142F]">פרטי מסמך</h2>
        <p>
          <span className="text-gray-500">פרויקט: </span>
          {diary.project?.name}
        </p>
        <p>
          <span className="text-gray-500">לקוח: </span>
          {diary.clientName || "—"}
        </p>
        <p>
          <span className="text-gray-500">כתובת: </span>
          {diary.address || "—"}
        </p>
        <p>
          <span className="text-gray-500">מנהל עבודה: </span>
          {diary.foreman?.name}
        </p>
        <p>
          <span className="text-gray-500">מזג אוויר / סוג: </span>
          {[diary.weather, diary.workType].filter(Boolean).join(" · ") || "—"}
        </p>
        {diary.workSummary && (
          <p className="whitespace-pre-wrap border-t border-gray-100 pt-2 mt-2">{diary.workSummary}</p>
        )}
      </section>

      {!!diary.workItems?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">פירוט עבודה</h2>
          <div className="space-y-2 text-sm">
            {diary.workItems.map((i: any) => (
              <div key={i.id} className="flex justify-between gap-3 border-b border-gray-50 pb-2">
                <span>
                  {i.lineNumber}. {i.description}
                </span>
                <span className="text-gray-500 shrink-0">
                  {i.quantity} {i.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!diary.workers?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">עובדים</h2>
          <div className="space-y-2 text-sm">
            {diary.workers.map((w: any) => (
              <div key={w.id} className="flex justify-between gap-3">
                <span>
                  {w.name}
                  {w.role ? ` · ${w.role}` : ""}
                </span>
                <span className="text-gray-500">
                  {w.startTime}-{w.endTime} ({w.hours}ש׳)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!diary.equipment?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">ציוד</h2>
          <ul className="text-sm space-y-1">
            {diary.equipment.map((e: any) => (
              <li key={e.id}>
                {e.name}
                {e.quantity != null ? ` × ${e.quantity}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!diary.materials?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">חומרים</h2>
          <ul className="text-sm space-y-1">
            {diary.materials.map((m: any) => (
              <li key={m.id}>
                {m.name} — {m.quantity} {m.unit}
              </li>
            ))}
          </ul>
        </section>
      )}

      {diary.notes && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-2">הערות</h2>
          <p className="text-sm whitespace-pre-wrap">{diary.notes}</p>
        </section>
      )}

      {diary.foremanSignatureUrl && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-2">חתימת מנהל עבודה</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={diary.foremanSignatureUrl} alt="חתימה" className="h-20 object-contain" />
        </section>
      )}

      {!!diary.approvals?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">אישורים</h2>
          <ul className="text-sm space-y-2">
            {diary.approvals.map((a: any) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>{a.approver?.name}</span>
                <span className="text-gray-500">
                  {approvalStatusLabel(a.status)}
                  {a.status === "rejected" && a.comment
                    ? `: ${a.comment}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!diary.events?.length && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-[#03142F] mb-3">היסטוריית פעולות</h2>
          <ul className="text-sm space-y-2">
            {diary.events.map((e: any) => (
              <li key={e.id} className="border-b border-gray-50 pb-2">
                <p>{e.message}</p>
                <p className="text-xs text-gray-400">
                  {e.actor?.name ? `${e.actor.name} · ` : ""}
                  {new Date(e.createdAt).toLocaleString("he-IL")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">בחירת מאשרים</h3>
              <button type="button" onClick={() => setShowSubmit(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {approvers.map((a) => {
                const checked = selected.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected((s) =>
                          checked ? s.filter((id) => id !== a.id) : [...s, a.id]
                        )
                      }
                    />
                    <span className="flex-1">
                      <span className="font-medium block">{a.name}</span>
                      <span className="text-xs text-gray-500">{a.roleLabel}</span>
                    </span>
                    {checked && <Check className="h-4 w-4 text-[#1e40af]" />}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="w-full rounded-xl bg-[#1e40af] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? "שולח…" : "שלח לאישור"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
