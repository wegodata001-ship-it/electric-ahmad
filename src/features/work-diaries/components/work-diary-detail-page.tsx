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
  assigned: "נשלח למנהל שטח",
  in_progress: "בטיפול",
  revision: "הוחזר לתיקון",
  pending_approval: "ממתין לאישור",
  in_approval: "ממתין לאישור",
  approved: "הושלם",
  sent_to_client: "נשלח ללקוח",
  client_signed: "נחתם ע״י לקוח",
  signed: "נחתם ע״י לקוח",
  completed: "הושלם",
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
  const [execution, setExecution] = useState({
    workSummary: "",
    notes: "",
    issues: "",
    percent: "",
    workersText: "",
  });
  const [uploading, setUploading] = useState(false);

  function hydrateExecution(next: any) {
    const percentItem = (next.workItems ?? []).find(
      (item: any) => item.description === "אחוז ביצוע"
    );
    setExecution({
      workSummary: next.workSummary || "",
      notes: next.notes || "",
      issues: "",
      percent: percentItem ? String(percentItem.quantity ?? "") : "",
      workersText: (next.workers ?? [])
        .map((w: any) =>
          [w.name, w.hours ? `${w.hours}` : ""].filter(Boolean).join(" | ")
        )
        .join("\n"),
    });
  }

  function reload() {
    return workDiariesService
      .get(id)
      .then((next) => {
        setDiary(next);
        hydrateExecution(next);
      })
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

  const assignedExec =
    diary.status === "assigned" || diary.status === "in_progress";
  const editable = diary.status === "draft" || diary.status === "revision";
  const done =
    diary.status === "approved" ||
    diary.status === "completed" ||
    diary.status === "signed" ||
    diary.status === "client_signed";

  async function saveExecution() {
    setSubmitting(true);
    setError("");
    try {
      const workers = execution.workersText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, hours] = line.split("|").map((p) => p.trim());
          return { name, hours: hours ? Number(hours) : 0 };
        });
      const notes = [execution.notes, execution.issues && `חריגים:\n${execution.issues}`]
        .filter(Boolean)
        .join("\n\n");
      const workItems = [
        ...(diary.workItems ?? [])
          .filter((item: any) => item.description !== "אחוז ביצוע")
          .map((item: any) => ({
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            notes: item.notes,
          })),
        ...(execution.percent
          ? [
              {
                description: "אחוז ביצוע",
                unit: "%",
                quantity: Number(execution.percent) || 0,
              },
            ]
          : []),
      ];
      const updated = await workDiariesService.update(id, {
        workSummary: execution.workSummary,
        notes,
        workers,
        workItems,
        expectedVersion: diary.currentVersion,
      });
      setDiary(updated);
      hydrateExecution(updated);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  async function completeDiary() {
    setSubmitting(true);
    setError("");
    try {
      await saveExecution();
      const updated = await workDiariesService.complete(id);
      setDiary(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("stage", "execution");
      const res = await fetch(`/api/field/work-diaries/${id}/media`, {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "העלאה נכשלה");
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

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
        {!editable && !assignedExec && !done && (
          <p className="text-sm text-gray-500">
            המסמך נעול לעריכה עד החזרה לתיקון או השלמת התהליך
          </p>
        )}
      </div>

      {assignedExec && (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4">
          <h2 className="font-bold text-[#03142F]">ביצוע בפועל</h2>
          <label className="block text-sm">
            <span className="font-semibold">מה בוצע</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={3}
              value={execution.workSummary}
              onChange={(e) =>
                setExecution((s) => ({ ...s, workSummary: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">עובדים שהיו באתר (שם | שעות)</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={3}
              value={execution.workersText}
              onChange={(e) =>
                setExecution((s) => ({ ...s, workersText: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">הערות</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={2}
              value={execution.notes}
              onChange={(e) =>
                setExecution((s) => ({ ...s, notes: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">בעיות / חריגים</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={2}
              value={execution.issues}
              onChange={(e) =>
                setExecution((s) => ({ ...s, issues: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">אחוז ביצוע</span>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={execution.percent}
              onChange={(e) =>
                setExecution((s) => ({ ...s, percent: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">תמונות מהשטח</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="mt-1 block"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void saveExecution()}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold"
            >
              שמור
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void completeDiary()}
              className="rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-bold text-white"
            >
              סיום יומן עבודה
            </button>
          </div>
        </section>
      )}

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
          <span className="text-gray-500">נשלח ע״י: </span>
          {diary.createdBy?.name || "—"}
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
