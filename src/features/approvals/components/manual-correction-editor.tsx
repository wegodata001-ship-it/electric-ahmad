"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";

type Kind = "work_diary" | "delivery_note";

type EditableItem = {
  id?: string;
  description: string;
  unit: string;
  quantity: number | string;
  notes?: string | null;
};

type EditableWorker = {
  id?: string;
  name: string;
  role?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number | string;
  notes?: string | null;
};

type EditableDocument = {
  id: string;
  documentNumber: string;
  currentVersion: number;
  clientName?: string | null;
  address?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  weather?: string | null;
  workType?: string | null;
  workSummary?: string | null;
  notes?: string | null;
  items?: EditableItem[];
  workItems?: EditableItem[];
  workers?: EditableWorker[];
};

export function ManualCorrectionEditor({
  kind,
  document,
  onSaved,
  onResubmit,
  creatorMode = false,
}: {
  kind: Kind;
  document: EditableDocument;
  onSaved: () => Promise<void>;
  onResubmit: () => Promise<void>;
  creatorMode?: boolean;
}) {
  const initial = useMemo(
    () => ({
      clientName: document.clientName || "",
      address: document.address || "",
      vehicleNumber: document.vehicleNumber || "",
      driverName: document.driverName || "",
      weather: document.weather || "",
      workType: document.workType || "",
      workSummary: document.workSummary || "",
      notes: document.notes || "",
      items: (kind === "delivery_note"
        ? document.items || []
        : document.workItems || []
      ).map((item) => ({ ...item })),
      workers: (document.workers || []).map((worker) => ({ ...worker })),
    }),
    [document, kind]
  );
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [error, setError] = useState("");

  const changed = (key: keyof typeof initial) =>
    JSON.stringify(draft[key]) !== JSON.stringify(initial[key]);

  function inputClass(key: keyof typeof initial) {
    return `w-full rounded-xl border px-3 py-2 text-sm ${
      changed(key) ? "border-amber-300 bg-amber-50" : "border-stone-200"
    }`;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const correctionData =
        kind === "delivery_note"
          ? {
              clientName: draft.clientName,
              address: draft.address,
              vehicleNumber: draft.vehicleNumber,
              driverName: draft.driverName,
              notes: draft.notes,
              items: draft.items,
            }
          : {
              clientName: draft.clientName,
              address: draft.address,
              weather: draft.weather,
              workType: draft.workType,
              workSummary: draft.workSummary,
              notes: draft.notes,
              workItems: draft.items,
              workers: draft.workers,
            };
      const response = await fetch(
        creatorMode
          ? `/api/field/${
              kind === "delivery_note"
                ? "ops-delivery-notes"
                : "work-diaries"
            }/${document.id}`
          : "/api/approvals/manual-correction",
        {
        method: creatorMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creatorMode
            ? {
                ...correctionData,
                expectedVersion: document.currentVersion,
              }
            : {
                kind,
                documentId: document.id,
                expectedVersion: document.currentVersion,
                data: correctionData,
              }
        ),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "שמירת התיקון נכשלה");
      }
      setSaved(true);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "שמירת התיקון נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function resubmit() {
    setResubmitting(true);
    setError("");
    try {
      await onResubmit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "השליחה מחדש נכשלה");
      setResubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border-2 border-amber-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black">
            תיקון מסמך {document.documentNumber}
          </h2>
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            הוחזר לתיקון
          </span>
        </div>
        <p className="text-xs text-stone-500">
          שדות ששונו מסומנים בצבע עדין
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
          התיקון נשמר בהצלחה
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="לקוח">
          <input
            className={inputClass("clientName")}
            value={draft.clientName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                clientName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="כתובת">
          <input
            className={inputClass("address")}
            value={draft.address}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
          />
        </Field>
        {kind === "delivery_note" ? (
          <>
            <Field label="מספר רכב">
              <input
                className={inputClass("vehicleNumber")}
                value={draft.vehicleNumber}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    vehicleNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="נהג">
              <input
                className={inputClass("driverName")}
                value={draft.driverName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    driverName: event.target.value,
                  }))
                }
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="מזג אוויר">
              <input
                className={inputClass("weather")}
                value={draft.weather}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    weather: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="סוג עבודה">
              <input
                className={inputClass("workType")}
                value={draft.workType}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    workType: event.target.value,
                  }))
                }
              />
            </Field>
          </>
        )}
      </div>

      {kind === "work_diary" && (
        <Field label="תיאור העבודה">
          <textarea
            rows={3}
            className={inputClass("workSummary")}
            value={draft.workSummary}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                workSummary: event.target.value,
              }))
            }
          />
        </Field>
      )}

      <Field label="הערות">
        <textarea
          rows={3}
          className={inputClass("notes")}
          value={draft.notes}
          onChange={(event) =>
            setDraft((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </Field>

      <div className={changed("items") ? "rounded-2xl bg-amber-50 p-3" : ""}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-black">
            {kind === "delivery_note" ? "פריטי התעודה" : "פירוט עבודה"}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold text-blue-800"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                items: [
                  ...current.items,
                  { description: "", unit: "יח'", quantity: 0, notes: "" },
                ],
              }))
            }
          >
            <Plus className="h-4 w-4" /> שורה
          </button>
        </div>
        <div className="space-y-2">
          {draft.items.map((item, index) => (
            <div
              key={item.id || index}
              className="grid grid-cols-[1fr_90px_36px] gap-2"
            >
              <input
                className="rounded-xl border px-3 py-2 text-sm"
                aria-label={`תיאור שורה ${index + 1}`}
                value={item.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, description: event.target.value }
                        : row
                    ),
                  }))
                }
              />
              <input
                type="number"
                className="rounded-xl border px-2 py-2 text-sm"
                aria-label={`כמות שורה ${index + 1}`}
                value={item.quantity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, quantity: event.target.value }
                        : row
                    ),
                  }))
                }
              />
              <button
                type="button"
                aria-label={`מחיקת שורה ${index + 1}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.filter(
                      (_row, rowIndex) => rowIndex !== index
                    ),
                  }))
                }
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {kind === "work_diary" && (
        <div className={changed("workers") ? "rounded-2xl bg-amber-50 p-3" : ""}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-black">עובדים ושעות</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-bold text-blue-800"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  workers: [
                    ...current.workers,
                    { name: "", startTime: "", endTime: "", hours: 0 },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" /> עובד
            </button>
          </div>
          <div className="space-y-2">
            {draft.workers.map((worker, index) => (
              <div
                key={worker.id || index}
                className="grid grid-cols-[1fr_90px_90px_36px] gap-2"
              >
                <input
                  className="rounded-xl border px-2 py-2 text-sm"
                  aria-label={`שם עובד ${index + 1}`}
                  value={worker.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      workers: current.workers.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, name: event.target.value }
                          : row
                      ),
                    }))
                  }
                />
                <input
                  type="time"
                  className="rounded-xl border px-2 py-2 text-sm"
                  value={worker.startTime || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      workers: current.workers.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, startTime: event.target.value }
                          : row
                      ),
                    }))
                  }
                />
                <input
                  type="time"
                  className="rounded-xl border px-2 py-2 text-sm"
                  value={worker.endTime || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      workers: current.workers.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, endTime: event.target.value }
                          : row
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  aria-label={`מחיקת עובד ${index + 1}`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      workers: current.workers.filter(
                        (_row, rowIndex) => rowIndex !== index
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || saved}
          onClick={() => void save()}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 font-black text-white disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          שמור תיקון
        </button>
        {saved && (
          <button
            type="button"
            disabled={resubmitting}
            onClick={() => void resubmit()}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 font-black text-white"
          >
            {resubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            שלח מחדש לאישור
          </button>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-stone-600">
        {label}
      </span>
      {children}
    </label>
  );
}
