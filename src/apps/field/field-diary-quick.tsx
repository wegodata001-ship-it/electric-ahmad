"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { pickDefaultApproverIds } from "@/lib/approvers/default-approvers";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

function lines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

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
  const [projectId, setProjectId] = useState("");
  const [workDate, setWorkDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [address, setAddress] = useState("");
  const [workType, setWorkType] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [workersText, setWorkersText] = useState("");
  const [hoursText, setHoursText] = useState("");
  const [equipmentText, setEquipmentText] = useState("");
  const [vehiclesText, setVehiclesText] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"draft" | "submit" | null>(
    null
  );
  const [allowSkip, setAllowSkip] = useState(true);

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
        setProjectId(d.projectId || "");
        setWorkDate(
          d.workDate
            ? String(d.workDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10)
        );
        setAddress(d.address || "");
        setWorkType(d.workType || "");
        setWorkSummary(d.workSummary || "");
        setNotes(d.notes || "");
        setWorkersText(
          (d.workers || [])
            .map((w: any) =>
              w.hours ? `${w.name}|${w.hours}` : w.name || ""
            )
            .filter(Boolean)
            .join("\n")
        );
        setEquipmentText(
          (d.equipment || [])
            .map((e: any) => e.name)
            .filter((n: string) => n && !String(n).startsWith("רכב:"))
            .join("\n")
        );
        setVehiclesText(
          (d.equipment || [])
            .map((e: any) => e.name)
            .filter((n: string) => String(n).startsWith("רכב:"))
            .map((n: string) => n.replace(/^רכב:\s*/, ""))
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
        setRevisionNote(
          d.rejectionComment || d.revisionComment || "הוחזר לתיקון"
        );
      })
      .catch((e) => setError(e.message));
  }, [reviseId]);

  const selected = useMemo(
    () => orders.find((o) => o.id === orderId) || null,
    [orders, orderId]
  );

  useEffect(() => {
    if (!selected || reviseId) return;
    setProjectId(selected.projectId);
    setWorkDate(selected.date.slice(0, 10));
    setAddress(selected.address || selected.project?.location || "");
    setWorkersText(
      selected.workers
        .map((w) => (w.hours ? `${w.name}|${w.hours}` : w.name))
        .join("\n")
    );
    setVehiclesText(
      (selected.vehicles || [])
        .map((v) => [v.name, v.plate].filter(Boolean).join(" "))
        .join("\n")
    );
  }, [selected, reviseId]);

  useEffect(() => {
    if (!projectId || selected || reviseId) return;
    const p = projects.find((x) => x.id === projectId);
    if (p?.location && !address) setAddress(p.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function uploadMedia(diaryId: string) {
    for (const file of [...photos, ...files].slice(0, 12)) {
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
    const workers = lines(workersText).map((line) => {
      const [name, hrs] = line.split("|").map((s) => s.trim());
      return {
        name: name || line,
        hours: Number(hrs) || Number(hoursText) || 0,
      };
    });
    const equipment = [
      ...lines(equipmentText).map((name) => ({ name })),
      ...lines(vehiclesText).map((name) => ({ name: `רכב: ${name}` })),
    ];
    const materials = lines(materialsText).map((line) => {
      const [name, qty, unit] = line.split("|").map((s) => s.trim());
      return {
        name: name || line,
        quantity: Number(qty) || 1,
        unit: unit || "יח'",
      };
    });
    return {
      projectId,
      workDate,
      workType: workType.trim() || null,
      workSummary: workSummary.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      clientName:
        selected?.clientName ||
        selected?.project?.contractor ||
        projects.find((p) => p.id === projectId)?.contractor ||
        null,
      workers,
      equipment,
      materials,
      workItems: workSummary.trim()
        ? [{ description: workSummary.trim(), quantity: 1, unit: "יח'" }]
        : [],
    };
  }

  async function requestSave(mode: "draft" | "submit") {
    setError("");
    if (!reviseId && !projectId) {
      setError("יש לבחור פרויקט");
      return;
    }
    if (!workSummary.trim()) {
      setError("כתוב מה בוצע");
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
    }
    await doSave(mode);
  }

  async function doSave(mode: "draft" | "submit") {
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
        const approvers = await workDiariesService.listApprovers();
        const approverIds = pickDefaultApproverIds(approvers.items);
        if (!approverIds.length) throw new Error("אין מאשרים במערכת");
        await workDiariesService.submit(diaryId, approverIds);
        router.replace("/field/approvals");
      } else {
        router.replace("/field/work-diaries");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
      setPendingMode(null);
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
            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">פרויקט</span>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (orderId) {
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
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">
                סידור עבודה (אופציונלי)
              </span>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className={field.input}
              >
                <option value="">ללא סידור / יצירה עצמאית</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.project?.name || "פרויקט"} ·{" "}
                    {new Date(order.date).toLocaleDateString("he-IL")} ·{" "}
                    {STATUS_LABELS[order.status]}
                  </option>
                ))}
              </select>
            </label>
          </>
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
          <span className="text-lg font-bold text-[#111827]">מקום עבודה</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="כתובת / אתר"
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">סוג עבודה</span>
          <input
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            placeholder="חשמל · תאורה · לוחות"
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">מה בוצע?</span>
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
            עובדים (שורה: שם או שם|שעות)
          </span>
          <textarea
            value={workersText}
            onChange={(e) => setWorkersText(e.target.value)}
            rows={3}
            placeholder={"ישראל ישראלי|8\nדוד כהן|6"}
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">
            שעות עבודה (ברירת מחדל לשורה בלי שעות)
          </span>
          <input
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
            inputMode="decimal"
            placeholder="8"
            className={field.input}
          />
        </label>

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
          <span className="text-lg font-bold text-[#111827]">רכבים</span>
          <textarea
            value={vehiclesText}
            onChange={(e) => setVehiclesText(e.target.value)}
            rows={2}
            placeholder="מספר רכב / תיאור"
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">
            חומרים (שורה: שם|כמות|יחידה)
          </span>
          <textarea
            value={materialsText}
            onChange={(e) => setMaterialsText(e.target.value)}
            rows={2}
            placeholder={"כבל 3×2.5|50|מ'"}
            className={field.input}
          />
        </label>

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
            <label className="block space-y-2">
              <span className="text-lg font-bold text-[#111827]">תמונות</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) =>
                  setPhotos(Array.from(e.target.files || []).slice(0, 8))
                }
                className="block w-full text-base text-[#6B7280] file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-bold file:text-white"
              />
              {photos.length > 0 && (
                <p className="text-base text-[#6B7280]">{photos.length} תמונות</p>
              )}
            </label>

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
          if (pendingMode) void doSave(pendingMode);
        }}
        onCheckedIn={() => {
          setGateOpen(false);
          if (pendingMode) void doSave(pendingMode);
        }}
      />
    </div>
  );
}
