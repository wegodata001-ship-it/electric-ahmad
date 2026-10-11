"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import {
  DIARY_STATUS_LABELS,
  ErrorState,
  PortalCard,
  PortalPage,
  StatusPill,
  formatDate,
} from "@/apps/subcontractor/portal-ui";
import { WORK_STATUS_COLORS, WORK_STATUS_LABELS } from "@/lib/subcontractors/constants";

type Detail = {
  id: string;
  projectName: string;
  contractNumber?: string | null;
  workSiteName: string | null;
  location: string;
  managerName: string | null;
  startDate: string | null;
  description: string;
  notes?: string | null;
  engagementLabel?: string;
  workStatus: string;
  workStatusLabel: string;
  reviewNotes: string | null;
  tasks: Array<{ id: string; description: string; unit: string }>;
  diaries: Array<{
    id: string;
    documentNumber: string;
    workDate: string;
    workSummary: string | null;
    status: string;
    signedPdfUrl?: string | null;
    media: Array<{ id: string; name: string; url: string }>;
  }>;
  measurements: Array<{
    id: string;
    statusLabel: string;
    itemCount: number;
    createdAt: string;
  }>;
  documents: Array<{ id: string; title: string; categoryLabel: string }>;
  history: Array<{ label: string; at: string }>;
};

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    workSummary: "",
    quantity: "",
    unit: "יחידה",
    hours: "",
    notes: "",
  });
  const [diaryId, setDiaryId] = useState("");

  async function load() {
    const next = await apiClient.get<Detail>(`/api/subcontractor/works/${id}`);
    setData(next);
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<Detail>(`/api/subcontractor/works/${id}`)
      .then((next) => {
        if (live) setData(next);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (error && !data) return <ErrorState message={error} onRetry={() => load().catch((e) => setError(e.message))} />;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  const canStart = ["assigned", "returned"].includes(data.workStatus);
  const canReport = ["in_progress", "returned"].includes(data.workStatus);
  const photos = data.diaries.flatMap((d) => d.media);

  return (
    <PortalPage
      title={data.projectName}
      subtitle={data.description}
      actions={
        <StatusPill
          label={data.workStatusLabel || WORK_STATUS_LABELS[data.workStatus]}
          className={WORK_STATUS_COLORS[data.workStatus]}
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <PortalCard>
            <h2 className="font-black">פרטי הפרויקט</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <Field label="מספר עבודה" value={data.contractNumber || data.id.slice(-6)} />
              <Field label="סניף" value={data.workSiteName || "ללא סניף"} />
              <Field label="כתובת" value={data.location || "—"} />
              <Field label="מנהל שטח" value={data.managerName || "לא צוין"} />
              <Field label="תאריך התחלה" value={formatDate(data.startDate)} />
              <Field label="סוג עבודה" value={data.engagementLabel || "—"} />
            </dl>
          </PortalCard>

          <PortalCard>
            <h2 className="font-black">הוראות ביצוע</h2>
            <p className="mt-2 text-sm leading-6">{data.description}</p>
            {data.notes && <p className="mt-2 text-sm text-[#5B6470]">{data.notes}</p>}
            {data.reviewNotes && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                הוחזר: {data.reviewNotes}
              </p>
            )}
            {data.tasks.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pr-5 text-sm">
                {data.tasks.map((t) => (
                  <li key={t.id}>
                    {t.description} ({t.unit})
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          {canStart && (
            <Button
              className="min-h-14 w-full text-base"
              onClick={() =>
                apiClient
                  .patch(`/api/subcontractor/works/${id}`, { action: "start" })
                  .then(() => load())
                  .catch((e) => setError(e.message))
              }
            >
              התחל עבודה
            </Button>
          )}

          {canReport && (
            <PortalCard className="scroll-mt-24" >
              <h2 id="report" className="mb-3 font-black">שליחת דיווח</h2>
              <textarea
                className="mb-2 min-h-24 w-full rounded-xl border border-[#E6E8EB] px-3 py-3"
                placeholder="תיאור ביצוע"
                value={form.workSummary}
                onChange={(e) => setForm((p) => ({ ...p, workSummary: e.target.value }))}
              />
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
                <input
                  className="min-h-12 rounded-xl border border-[#E6E8EB] px-3"
                  placeholder="כמות עבודה"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
                <input
                  className="min-h-12 rounded-xl border border-[#E6E8EB] px-3"
                  placeholder="יחידת מידה"
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                />
              </div>
              <input
                className="mb-2 min-h-12 w-full rounded-xl border border-[#E6E8EB] px-3"
                placeholder="שעות עבודה"
                value={form.hours}
                onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
              />
              <textarea
                className="mb-2 min-h-20 w-full rounded-xl border border-[#E6E8EB] px-3 py-3"
                placeholder="הערות"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
              <label className="mb-3 block text-sm font-bold">
                תמונות מהטלפון
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !diaryId) {
                      setError("שמרו טיוטה לפני צירוף תמונה");
                      return;
                    }
                    const fd = new FormData();
                    fd.append("file", file);
                    apiClient
                      .upload(`/api/subcontractor/work-diaries/${diaryId}/media`, fd)
                      .then(() => {
                        setOk("התמונה צורפה");
                        return load();
                      })
                      .catch((err) => setError(err.message));
                  }}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="min-h-12"
                  onClick={() =>
                    apiClient
                      .patch<{ id?: string }>(`/api/subcontractor/works/${id}`, {
                        action: "draft",
                        workSummary: form.workSummary,
                        notes: form.notes,
                        hours: form.hours ? Number(form.hours) : undefined,
                        workItems: form.quantity
                          ? [{ description: form.workSummary || data.description, unit: form.unit, quantity: Number(form.quantity) }]
                          : [],
                      })
                      .then((r) => {
                        if (r.id) setDiaryId(r.id);
                        setOk("הטיוטה נשמרה");
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  שמור טיוטה
                </Button>
                <Button
                  className="min-h-12"
                  onClick={() =>
                    apiClient
                      .patch<{ id?: string }>(`/api/subcontractor/works/${id}`, {
                        action: "submit",
                        workSummary: form.workSummary,
                        notes: form.notes,
                        hours: form.hours ? Number(form.hours) : undefined,
                        workItems: form.quantity
                          ? [{ description: form.workSummary || data.description, unit: form.unit, quantity: Number(form.quantity) }]
                          : [],
                      })
                      .then((r) => {
                        if (r.id) setDiaryId(r.id);
                        setOk("נשלח לאישור");
                        return load();
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  שלח לאישור
                </Button>
              </div>
            </PortalCard>
          )}
        </div>

        <div className="space-y-4">
          <PortalCard>
            <h2 className="font-black">דיווחים</h2>
            {data.diaries.length === 0 && <p className="mt-2 text-sm text-[#5B6470]">עדיין אין דיווחים להצגה</p>}
            <div className="mt-3 space-y-2">
              {data.diaries.map((d) => (
                <div key={d.id} className="rounded-xl bg-[#F8F8F8] p-3 text-sm">
                  <p className="font-bold">{d.documentNumber}</p>
                  <p className="text-[#5B6470]">{d.workDate} · {DIARY_STATUS_LABELS[d.status] || d.status}</p>
                  {d.signedPdfUrl && (
                    <a href={d.signedPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#C8102E]">
                      פתח PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          </PortalCard>
          <PortalCard>
            <h2 className="font-black">מדידות</h2>
            {data.measurements.length === 0 && <p className="mt-2 text-sm text-[#5B6470]">אין מדידות לעבודה זו</p>}
            <div className="mt-3 space-y-2">
              {data.measurements.map((m) => (
                <Link key={m.id} href={`/subcontractor/measurements/${m.id}`} className="block rounded-xl bg-[#F8F8F8] p-3 text-sm">
                  <p className="font-bold">{m.statusLabel}</p>
                  <p className="text-[#5B6470]">{m.itemCount} סעיפים · {formatDate(m.createdAt)}</p>
                </Link>
              ))}
            </div>
          </PortalCard>
          <PortalCard>
            <h2 className="font-black">תמונות</h2>
            {photos.length === 0 && <p className="mt-2 text-sm text-[#5B6470]">אין תמונות מצורפות</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt={p.name} className="h-20 w-full rounded-lg object-cover" />
              ))}
            </div>
          </PortalCard>
          <PortalCard>
            <h2 className="font-black">מסמכים</h2>
            {data.documents.length === 0 && <p className="mt-2 text-sm text-[#5B6470]">אין מסמכים</p>}
            <div className="mt-3 space-y-2">
              {data.documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="block w-full rounded-xl bg-[#F8F8F8] p-3 text-right text-sm"
                  onClick={() =>
                    apiClient
                      .get<{ url: string }>(`/api/subcontractor/documents/${d.id}/url`)
                      .then((r) => window.open(r.url, "_blank"))
                      .catch((e) => setError(e.message))
                  }
                >
                  <p className="font-bold">{d.title}</p>
                  <p className="text-[#5B6470]">{d.categoryLabel}</p>
                </button>
              ))}
            </div>
          </PortalCard>
          <PortalCard>
            <h2 className="font-black">היסטוריית סטטוסים</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {data.history.map((h) => (
                <li key={`${h.label}-${h.at}`} className="flex justify-between gap-3">
                  <span className="font-bold">{h.label}</span>
                  <span className="text-[#5B6470]">{formatDate(h.at)}</span>
                </li>
              ))}
            </ol>
          </PortalCard>
        </div>
      </div>
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </PortalPage>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[#5B6470]">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
