"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { fetchClientMe } from "@/lib/auth/client-me";
import {
  hasDocumentPermission,
  isSystemAdminRole,
} from "@/lib/auth/document-permissions";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";

const STATUS_LABEL: Record<string, string> = {
  ...WORKFLOW_STATUS_LABELS,
  completed: "הושלם",
  signed: "נחתם",
  in_approval: "ממתין לאישור",
};

type FieldManager = { id: string; userId: string; name: string; phone: string };
type DiaryItem = {
  id: string;
  documentNumber: string;
  status: string;
  statusLabel?: string;
  workDate: string;
  workSummary?: string | null;
  workItems?: { description: string }[];
  project?: { id: string; name: string } | null;
  foreman?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
};

type Props = {
  projectId: string;
  projectName?: string;
  openCreateKey?: number;
  onCountsChange?: (counts: {
    total: number;
    completed: number;
    inProgress: number;
  }) => void;
};

export function ProjectWorkDiariesPanel({
  projectId,
  projectName,
  openCreateKey,
  onCountsChange,
}: Props) {
  const [items, setItems] = useState<DiaryItem[]>([]);
  const [managers, setManagers] = useState<FieldManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    workDate: new Date().toISOString().slice(0, 10),
    foremanId: "",
    workType: "",
    workSummary: "",
    notes: "",
    tasks: "",
    workers: "",
  });
  const [files, setFiles] = useState<File[]>([]);

  const canCreate = hasDocumentPermission(role, "create");
  const canReassign = isSystemAdminRole(role);
  const canReturn = hasDocumentPermission(role, "return_for_revision");

  function reloadList() {
    return apiClient
      .get<{
        items: DiaryItem[];
        counts?: { total: number; completed: number; inProgress: number };
      }>(`/api/work-diaries?projectId=${projectId}&take=100`)
      .then((r) => {
        setItems(r.items ?? []);
        if (r.counts) onCountsChange?.(r.counts);
      });
  }

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => {
        setRole(json.success ? json.data?.role ?? null : null);
      })
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    setView("list");
    setSelectedId(null);
    setDetail(null);
    Promise.all([
      reloadList(),
      apiClient
        .get<{ items: FieldManager[] }>("/api/work-diaries/field-managers")
        .then((r) => setManagers(r.items ?? []))
        .catch(() => setManagers([])),
    ])
      .catch((e) => setError(e.message || "שגיאה בטעינה"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!openCreateKey) return;
    setView("create");
    setSelectedId(null);
    setDetail(null);
    setWhatsappUrl(null);
  }, [openCreateKey]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || detail,
    [items, selectedId, detail]
  );

  async function openDetail(id: string) {
    setError("");
    setSelectedId(id);
    setView("detail");
    const diary = await apiClient.get<any>(`/api/work-diaries/${id}`);
    setDetail(diary);
  }

  async function uploadPending(diaryId: string) {
    for (const file of files) {
      const data = new FormData();
      data.append("file", file);
      await fetch(`/api/work-diaries/${diaryId}/attachments`, {
        method: "POST",
        body: data,
      });
    }
  }

  async function save(assign: boolean) {
    if (!form.foremanId) {
      setError("יש לבחור מנהל שטח");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const workItems = form.tasks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((description) => ({ description, unit: "יח'", quantity: 0 }));
      const workers = form.workers
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      const created = await apiClient.post<any>("/api/work-diaries", {
        projectId,
        foremanId: form.foremanId,
        workDate: form.workDate,
        workType: form.workType || null,
        workSummary: form.workSummary || null,
        notes: form.notes || null,
        workItems,
        workers,
        assign,
      });
      const diary = created.diary ?? created;
      if (files.length) await uploadPending(diary.id);
      await reloadList();
      setFiles([]);
      setWhatsappUrl(created.whatsappUrl ?? null);
      await openDetail(diary.id);
    } catch (e: any) {
      setError(e.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function sendExisting() {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiClient.post<any>(
        `/api/work-diaries/${selectedId}/assign`,
        { foremanId: detail?.foremanId }
      );
      setWhatsappUrl(result.whatsappUrl ?? null);
      setDetail(result.diary ?? result);
      await reloadList();
    } catch (e: any) {
      setError(e.message || "שגיאה בשליחה");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReassign() {
    if (!selectedId || !reassignId) return;
    setSaving(true);
    setError("");
    try {
      const diary = await apiClient.post<any>(
        `/api/work-diaries/${selectedId}/reassign`,
        { foremanId: reassignId }
      );
      setDetail(diary);
      setReassignOpen(false);
      await reloadList();
    } catch (e: any) {
      setError(e.message || "שגיאה בהעברה");
    } finally {
      setSaving(false);
    }
  }

  async function returnDiary() {
    if (!selectedId || !returnComment.trim()) {
      setError("יש לרשום הערה להחזרה");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const diary = await apiClient.post<any>(
        `/api/work-diaries/${selectedId}/return`,
        { comment: returnComment }
      );
      setDetail(diary);
      setReturnComment("");
      await reloadList();
    } catch (e: any) {
      setError(e.message || "שגיאה בהחזרה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">טוען…</p>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">יומן עבודה</h2>
          <p className="text-sm text-gray-500">{items.length} יומנים</p>
        </div>
        {canCreate && view === "list" && (
          <button
            type="button"
            onClick={() => {
              setView("create");
              setWhatsappUrl(null);
            }}
            className="rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-bold text-white"
          >
            + יומן עבודה חדש
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {view === "create" && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => setView("list")}
          >
            ← חזרה לרשימה
          </button>
          <Field label="פרויקט">
            <input
              className={inputCls}
              value={projectName || "הפרויקט הנבחר"}
              readOnly
            />
          </Field>
          <Field label="תאריך עבודה">
            <input
              type="date"
              className={inputCls}
              value={form.workDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, workDate: e.target.value }))
              }
            />
          </Field>
          <Field label="מנהל שטח">
            <select
              className={inputCls}
              value={form.foremanId}
              onChange={(e) =>
                setForm((f) => ({ ...f, foremanId: e.target.value }))
              }
            >
              <option value="">בחר מנהל שטח</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="אזור / קומה">
            <input
              className={inputCls}
              value={form.workType}
              onChange={(e) =>
                setForm((f) => ({ ...f, workType: e.target.value }))
              }
            />
          </Field>
          <Field label="תיאור העבודה">
            <textarea
              className={inputCls}
              rows={3}
              value={form.workSummary}
              onChange={(e) =>
                setForm((f) => ({ ...f, workSummary: e.target.value }))
              }
            />
          </Field>
          <Field label="משימות לביצוע">
            <textarea
              className={inputCls}
              rows={3}
              placeholder="שורה לכל משימה"
              value={form.tasks}
              onChange={(e) => setForm((f) => ({ ...f, tasks: e.target.value }))}
            />
          </Field>
          <Field label="הערות">
            <textarea
              className={inputCls}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <Field label="עובדים / צוות">
            <textarea
              className={inputCls}
              rows={2}
              placeholder="שורה לכל עובד"
              value={form.workers}
              onChange={(e) =>
                setForm((f) => ({ ...f, workers: e.target.value }))
              }
            />
          </Field>
          <Field label="מסמך / תמונה">
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              שמור טיוטה
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              className="rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              שלח למנהל שטח
            </button>
          </div>
        </div>
      )}

      {view === "list" && !items.length && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          אין יומני עבודה לפרויקט זה
        </p>
      )}

      {view === "list" && (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openDetail(item.id).catch((e) => setError(e.message))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-right"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.documentNumber}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.project?.name || projectName || "פרויקט"} ·{" "}
                    {item.workDate}
                  </p>
                  {!!item.workItems?.length && (
                    <p className="mt-1 text-xs text-gray-500">
                      {item.workItems.map((w) => w.description).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    נשלח ע״י {item.createdBy?.name || "—"} · מנהל שטח{" "}
                    {item.foreman?.name || "—"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {item.statusLabel || STATUS_LABEL[item.status] || item.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === "detail" && detail && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => {
              setView("list");
              setWhatsappUrl(null);
            }}
          >
            ← חזרה לרשימה
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{detail.documentNumber}</h3>
              <p className="text-sm text-gray-500">
                {STATUS_LABEL[detail.status] || detail.statusLabel} ·{" "}
                {detail.workDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(detail.status === "approved" ||
                detail.status === "completed" ||
                detail.status === "signed" ||
                detail.status === "client_signed") && (
                <a
                  href={`/print/work-diaries/${detail.id}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-[#1e40af] px-4 py-2 text-sm font-semibold text-[#1e40af]"
                >
                  הפק PDF
                </a>
              )}
              {canCreate &&
                (detail.status === "draft" || detail.status === "revision") && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={sendExisting}
                    className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-bold text-white"
                  >
                    שלח למנהל שטח במערכת
                  </button>
                )}
              {canReassign && (
                <button
                  type="button"
                  onClick={() => {
                    setReassignId("");
                    setReassignOpen(true);
                  }}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold"
                >
                  העבר למנהל אחר
                </button>
              )}
            </div>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Row label="פרויקט" value={detail.project?.name} />
            <Row label="לקוח" value={detail.clientName} />
            <Row label="מנהל שטח" value={detail.foreman?.name} />
            <Row
              label="נשלח ע״י"
              value={detail.createdBy?.name || selected?.createdBy?.name}
            />
            <Row label="אזור / קומה" value={detail.workType} />
            <Row label="כתובת" value={detail.address} />
          </dl>
          {detail.workSummary && (
            <p className="whitespace-pre-wrap text-sm">{detail.workSummary}</p>
          )}
          {!!detail.workItems?.length && (
            <ul className="list-disc pr-5 text-sm">
              {detail.workItems.map((item: any) => (
                <li key={item.id || item.description}>{item.description}</li>
              ))}
            </ul>
          )}
          {!!detail.workers?.length && (
            <ul className="text-sm">
              {detail.workers.map((w: any) => (
                <li key={w.id}>
                  {w.name}
                  {w.hours ? ` · ${w.hours}ש׳` : ""}
                </li>
              ))}
            </ul>
          )}
          {detail.notes && (
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {detail.notes}
            </p>
          )}

          {(whatsappUrl ||
            ((detail.status === "assigned" ||
              detail.status === "in_progress") &&
              detail.foreman?.phone)) && (
            <a
              href={
                whatsappUrl ||
                `https://wa.me/${String(detail.foreman.phone).replace(/\D/g, "")}?text=${encodeURIComponent(
                  `יומן עבודה חדש\n${detail.project?.name || ""}\n${detail.workDate}\n\nפתח יומן:\n${typeof window !== "undefined" ? window.location.origin : ""}/field/work-diaries/${detail.id}`
                )}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
            >
              שלח קישור ב-WhatsApp
            </a>
          )}

          {canReturn &&
            (detail.status === "assigned" ||
              detail.status === "in_progress") && (
              <div className="space-y-2 border-t pt-3">
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="הערת החזרה לתיקון"
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={returnDiary}
                  className="rounded-xl border border-orange-400 px-4 py-2 text-sm font-semibold text-orange-700"
                >
                  החזר לתיקון
                </button>
              </div>
            )}

          {reassignOpen && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold">
                מנהל שטח נוכחי: {detail.foreman?.name || "—"}
              </p>
              <select
                className={inputCls}
                value={reassignId}
                onChange={(e) => setReassignId(e.target.value)}
              >
                <option value="">בחר מנהל שטח</option>
                {managers
                  .filter((m) => m.id !== detail.foremanId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={confirmReassign}
                  className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-bold text-white"
                >
                  אישור
                </button>
                <button
                  type="button"
                  onClick={() => setReassignOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1e40af]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
