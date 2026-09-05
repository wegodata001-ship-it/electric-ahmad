"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import { workDiariesService } from "@/features/work-diaries/services/work-diaries.service";
import {
  FieldAttendanceGate,
  requireAttendanceForAction,
} from "@/apps/field/field-attendance-gate";
import { FieldApproverPicker } from "@/apps/field/field-approver-picker";
import {
  DIARY_PHOTO_STAGES,
  FieldMediaCapture,
} from "@/apps/shared/field-media-capture";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

const OTHER = "__OTHER__";

function hoursBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

let keySeq = 0;
const nextKey = () => `w${++keySeq}`;

type WorkerRow = {
  key: string;
  name: string;
  startTime: string;
  endTime: string;
  hours: number;
  notes: string;
};

function emptyWorker(): WorkerRow {
  return {
    key: nextKey(),
    name: "",
    startTime: "07:00",
    endTime: "16:00",
    hours: 9,
    notes: "",
  };
}

/**
 * Site Manager work diary — mobile first.
 * Core fields + extensible optional sections (equipment/materials) for future growth.
 */
export function FieldDiaryQuick() {
  const router = useRouter();
  const params = useSearchParams();
  const preselect = params.get("workOrderId") || "";
  const reviseId = params.get("reviseId") || "";

  const [projects, setProjects] = useState<
    { id: string; name: string; location: string; contractor: string }[]
  >([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [orderId, setOrderId] = useState(preselect);
  const [projectChoice, setProjectChoice] = useState("");
  const [customSiteName, setCustomSiteName] = useState("");
  const [workDate, setWorkDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [weather, setWeather] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [workers, setWorkers] = useState<WorkerRow[]>([emptyWorker()]);
  const [showExtra, setShowExtra] = useState(false);
  const [equipmentText, setEquipmentText] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoStage, setPhotoStage] = useState("site");
  const [files, setFiles] = useState<File[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"draft" | "submit" | null>(
    null
  );
  const [allowSkip, setAllowSkip] = useState(true);

  const isOther = projectChoice === OTHER;

  useEffect(() => {
    Promise.all([
      fieldService.getDashboard().catch(() => null),
      workManagementService.list().catch(() => null),
    ]).then(([dash, wo]) => {
      if (dash?.projects) setProjects(dash.projects);
      if (wo?.items) setOrders(wo.items);
    });
  }, []);

  useEffect(() => {
    if (!reviseId) return;
    workDiariesService
      .get(reviseId)
      .then((d) => {
        if (d.customSiteName) {
          setProjectChoice(OTHER);
          setCustomSiteName(d.customSiteName);
        } else {
          setProjectChoice(d.projectId || "");
        }
        setWorkDate(
          d.workDate
            ? String(d.workDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10)
        );
        setWeather(d.weather || "");
        setWorkSummary(d.workSummary || "");
        setNotes(d.notes || "");
        const rows = (d.workers || []).map((w: any) => ({
          key: nextKey(),
          name: w.name || "",
          startTime: w.startTime || "07:00",
          endTime: w.endTime || "16:00",
          hours:
            typeof w.hours === "number"
              ? w.hours
              : hoursBetween(w.startTime, w.endTime),
          notes: w.notes || "",
        }));
        setWorkers(rows.length ? rows : [emptyWorker()]);
        setEquipmentText(
          (d.equipment || [])
            .map((e: any) => e.name)
            .filter(Boolean)
            .join("\n")
        );
        setMaterialsText(
          (d.materials || [])
            .map((m: any) =>
              m.quantity
                ? `${m.name}|${m.quantity}|${m.unit || "יח'"}`
                : m.name
            )
            .join("\n")
        );
        if ((d.equipment || []).length || (d.materials || []).length) {
          setShowExtra(true);
        }
        setRevisionNote(
          d.rejectionComment || d.revisionComment || "הוחזר לתיקון"
        );
        if (d.foremanSignatureUrl) setSignature(d.foremanSignatureUrl);
      })
      .catch((e) => setError(e.message));
  }, [reviseId]);

  const selected = useMemo(
    () => orders.find((o) => o.id === orderId) || null,
    [orders, orderId]
  );

  useEffect(() => {
    if (!selected || reviseId) return;
    setProjectChoice(selected.projectId);
    setWorkDate(selected.date.slice(0, 10));
    const rows = selected.workers.map((w) => ({
      key: nextKey(),
      name: w.name,
      startTime: w.startTime || "07:00",
      endTime: w.endTime || "16:00",
      hours:
        w.hours ||
        hoursBetween(w.startTime || undefined, w.endTime || undefined) ||
        0,
      notes: "",
    }));
    if (rows.length) setWorkers(rows);
  }, [selected, reviseId]);

  function updateWorker(key: string, patch: Partial<WorkerRow>) {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.key !== key) return w;
        const next = { ...w, ...patch };
        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          next.hours = hoursBetween(next.startTime, next.endTime);
        }
        return next;
      })
    );
  }

  async function uploadMedia(diaryId: string) {
    for (const file of photos.slice(0, 12)) {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("stage", photoStage);
        await fetch(`/api/field/work-diaries/${diaryId}/media`, {
          method: "POST",
          body: form,
        });
      } catch {
        /* optional */
      }
    }
    for (const file of files.slice(0, 8)) {
      try {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/field/work-diaries/${diaryId}/media`, {
          method: "POST",
          body: form,
        });
      } catch {
        /* optional */
      }
    }
  }

  function buildPayload() {
    const equipment = equipmentText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    const materials = materialsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, qty, unit] = line.split("|").map((s) => s.trim());
        return {
          name: name || line,
          quantity: Number(qty) || 1,
          unit: unit || "יח'",
        };
      });

    const workerPayload = workers
      .filter((w) => w.name.trim())
      .map((w) => ({
        name: w.name.trim(),
        startTime: w.startTime || null,
        endTime: w.endTime || null,
        hours: w.hours || hoursBetween(w.startTime, w.endTime),
        notes: w.notes.trim() || null,
      }));

    const site = customSiteName.trim();
    return {
      projectId: isOther ? null : projectChoice || null,
      customSiteName: isOther ? site : null,
      workDate,
      weather: weather.trim() || null,
      workSummary: workSummary.trim(),
      address: isOther ? site || null : null,
      notes: notes.trim() || null,
      clientName: isOther
        ? site || null
        : selected?.clientName ||
          selected?.project?.contractor ||
          projects.find((p) => p.id === projectChoice)?.contractor ||
          null,
      workers: workerPayload,
      equipment,
      materials,
      foremanSignatureUrl: signature,
      workItems: workSummary.trim()
        ? [{ description: workSummary.trim(), quantity: 1, unit: "יח'" }]
        : [],
    };
  }

  async function requestSave(mode: "draft" | "submit") {
    setError("");
    if (!reviseId) {
      if (!projectChoice) {
        setError("יש לבחור פרויקט או ״אחר״");
        return;
      }
      if (isOther && !customSiteName.trim()) {
        setError("הזינו שם מקום / אתר");
        return;
      }
    }
    if (!workSummary.trim()) {
      setError("כתוב מה בוצע");
      return;
    }
    if (mode === "submit" && !signature) {
      setError("יש לחתום לפני שליחה לאישור");
      return;
    }
    if (mode === "submit") {
      try {
        const gate = await requireAttendanceForAction("diary");
        if (gate.needPrompt) {
          setAllowSkip(gate.allowSkip);
          setPendingMode(mode);
          setGateOpen(true);
          return;
        }
      } catch {
        /* continue */
      }
      setPickerOpen(true);
      return;
    }
    await doSave(mode);
  }

  async function doSave(mode: "draft" | "submit", approverIds?: string[]) {
    setBusy(true);
    setError("");
    try {
      const payload = buildPayload();
      let diaryId = reviseId;

      if (reviseId) {
        await workDiariesService.update(reviseId, payload);
      } else {
        const diary = await workDiariesService.create(payload);
        diaryId = diary.id;
        await uploadMedia(diaryId);
      }

      if (!diaryId) throw new Error("שגיאה ביצירת יומן");

      if (mode === "submit") {
        if (!approverIds?.length) throw new Error("יש לבחור לפחות מאשר אחד");
        await workDiariesService.submit(diaryId, approverIds);
        router.replace("/field/work-diaries");
      } else {
        router.replace("/field/work-diaries");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
      setPendingMode(null);
      setPickerOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={field.title}>
          {reviseId ? "תיקון יומן" : "יומן עבודה חדש"}
        </h1>
        <p className={field.subtitle}>מילוי · טיוטה או שליחה לאישור</p>
      </div>

      {revisionNote && <RevisionFeedbackBanner comment={revisionNote} />}
      {error && <p className={field.error}>{error}</p>}

      <div className="space-y-5">
        {!reviseId && (
          <>
            <div className="space-y-2">
              <span className="text-lg font-bold text-[#111827]">פרויקט</span>
              <select
                value={projectChoice}
                onChange={(e) => {
                  setProjectChoice(e.target.value);
                  if (orderId && e.target.value !== OTHER) {
                    const o = orders.find((x) => x.id === orderId);
                    if (o && o.projectId !== e.target.value) setOrderId("");
                  }
                }}
                className={field.input}
                required
              >
                <option value="">בחרו פרויקט</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={OTHER}>➕ אחר</option>
              </select>
            </div>

            {isOther && (
              <label className="block space-y-2">
                <span className="text-lg font-bold text-[#111827]">
                  שם המקום / האתר
                </span>
                <input
                  value={customSiteName}
                  onChange={(e) => setCustomSiteName(e.target.value)}
                  placeholder="אתר זמני או מקום שאינו בפרויקטים"
                  className={field.input}
                />
              </label>
            )}

            {!isOther && (
              <label className="block space-y-2">
                <span className="text-lg font-bold text-[#111827]">
                  סידור עבודה (אופציונלי)
                </span>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className={field.input}
                >
                  <option value="">ללא סידור</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.project?.name || "פרויקט"} ·{" "}
                      {new Date(order.date).toLocaleDateString("he-IL")} ·{" "}
                      {STATUS_LABELS[order.status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {reviseId && isOther && (
          <label className="block space-y-2">
            <span className="text-lg font-bold text-[#111827]">
              שם המקום / האתר
            </span>
            <input
              value={customSiteName}
              onChange={(e) => setCustomSiteName(e.target.value)}
              className={field.input}
            />
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">תאריך</span>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">
            תיאור העבודה שבוצעה
          </span>
          <textarea
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
            rows={4}
            placeholder="תאר את העבודה שבוצעה"
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">
            מזג אוויר (אופציונלי)
          </span>
          <input
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="בהיר · מעונן · גשום…"
            className={field.input}
          />
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-bold text-[#111827]">עובדים</span>
            <button
              type="button"
              onClick={() => setWorkers((w) => [...w, emptyWorker()])}
              className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-slate-900 px-4 text-base font-bold text-white"
            >
              <Plus className="h-5 w-5" />
              הוסף
            </button>
          </div>

          {workers.map((w) => (
            <div
              key={w.key}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start gap-2">
                <input
                  value={w.name}
                  onChange={(e) => updateWorker(w.key, { name: e.target.value })}
                  placeholder="שם העובד"
                  className={cn(field.input, "flex-1")}
                />
                {workers.length > 1 && (
                  <button
                    type="button"
                    aria-label="הסר עובד"
                    onClick={() =>
                      setWorkers((prev) => prev.filter((x) => x.key !== w.key))
                    }
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-sm font-bold text-slate-600">התחלה</span>
                  <input
                    type="time"
                    value={w.startTime}
                    onChange={(e) =>
                      updateWorker(w.key, { startTime: e.target.value })
                    }
                    className={field.input}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-bold text-slate-600">סיום</span>
                  <input
                    type="time"
                    value={w.endTime}
                    onChange={(e) =>
                      updateWorker(w.key, { endTime: e.target.value })
                    }
                    className={field.input}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-600">
                  סך שעות
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  value={w.hours || ""}
                  onChange={(e) =>
                    updateWorker(w.key, {
                      hours: Number(e.target.value) || 0,
                    })
                  }
                  className={field.input}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-600">
                  הערות (אופציונלי)
                </span>
                <input
                  value={w.notes}
                  onChange={(e) =>
                    updateWorker(w.key, { notes: e.target.value })
                  }
                  placeholder="הערה לעובד"
                  className={field.input}
                />
              </label>
            </div>
          ))}
        </div>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">הערות</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="אופציונלי"
            className={field.input}
          />
        </label>

        {!reviseId && (
          <>
            <FieldMediaCapture
              label="תמונות"
              files={photos}
              onChange={setPhotos}
              stage={photoStage}
              onStageChange={setPhotoStage}
              stages={DIARY_PHOTO_STAGES}
            />

            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">קבצים</span>
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setFiles(Array.from(e.target.files || []).slice(0, 8))
                }
                className="block w-full text-base text-[#6B7280] file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-bold file:text-white"
              />
              {files.length > 0 && (
                <p className="text-base text-[#6B7280]">{files.length} קבצים</p>
              )}
            </label>
          </>
        )}

        <div className="space-y-2">
          <span className="text-lg font-bold text-[#111827]">
            חתימת יוצר המסמך
          </span>
          <p className="text-sm text-slate-500">
            חובה לפני שליחה לאישור — חתמו באצבע על המסך
          </p>
          <SignaturePad value={signature} onChange={setSignature} height={160} />
        </div>

        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          className="text-base font-bold text-slate-600 underline"
        >
          {showExtra ? "הסתר פרטים נוספים" : "פרטים נוספים (ציוד · חומרים)"}
        </button>

        {showExtra && (
          <>
            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">ציוד</span>
              <textarea
                value={equipmentText}
                onChange={(e) => setEquipmentText(e.target.value)}
                rows={2}
                placeholder="שורה לכל פריט"
                className={field.input}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">
                חומרים (שם|כמות|יחידה)
              </span>
              <textarea
                value={materialsText}
                onChange={(e) => setMaterialsText(e.target.value)}
                rows={2}
                placeholder={"כבל 3×2.5|50|מ'"}
                className={field.input}
              />
            </label>
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void requestSave("draft")}
          className={cn(field.btnGhost, "min-h-16 text-xl")}
        >
          {busy && pendingMode !== "submit" ? "שומר…" : "שמור כטיוטה"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestSave("submit")}
          className={cn(field.btnSuccess, "min-h-16 text-xl")}
        >
          {busy && pendingMode === "submit"
            ? "שולח…"
            : reviseId
              ? "שלח שוב"
              : "שלח לאישור"}
        </button>
      </div>

      <FieldAttendanceGate
        open={gateOpen}
        allowSkip={allowSkip}
        onCancel={() => {
          setGateOpen(false);
          setPendingMode(null);
        }}
        onSkip={() => {
          setGateOpen(false);
          setPickerOpen(true);
        }}
        onCheckedIn={() => {
          setGateOpen(false);
          setPickerOpen(true);
        }}
      />

      <FieldApproverPicker
        open={pickerOpen}
        projectId={isOther ? null : projectChoice || null}
        busy={busy}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(ids) => void doSave("submit", ids)}
      />
    </div>
  );
}
