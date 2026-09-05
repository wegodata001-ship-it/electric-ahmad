"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fieldService } from "@/features/field/services/field.service";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import {
  opsDeliveryNotesService,
} from "@/features/work-diaries/services/work-diaries.service";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";
import {
  FieldAttendanceGate,
  requireAttendanceForAction,
} from "@/apps/field/field-attendance-gate";
import { FieldApproverPicker } from "@/apps/field/field-approver-picker";
import {
  DN_PHOTO_STAGES,
  FieldMediaCapture,
} from "@/apps/shared/field-media-capture";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

type EquipLine = { description: string; quantity: string; unit: string };

export function FieldDnQuick() {
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
  const [noteDate, setNoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EquipLine[]>([
    { description: "", quantity: "1", unit: "יח'" },
  ]);
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoStage, setPhotoStage] = useState("cargo");
  const [revisionNote, setRevisionNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    opsDeliveryNotesService
      .get(reviseId)
      .then((n) => {
        setProjectId(n.projectId || "");
        setNoteDate(
          n.noteDate
            ? String(n.noteDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10)
        );
        setClientName(n.clientName || "");
        setAddress(n.address || "");
        setVehicleNumber(n.vehicleNumber || "");
        setDriverName(n.driverName || "");
        setNotes(n.notes || "");
        const items = (n.items || []).map((it: any) => ({
          description: it.description || "",
          quantity: String(it.quantity ?? 1),
          unit: it.unit || "יח'",
        }));
        setLines(
          items.length
            ? items
            : [{ description: "", quantity: "1", unit: "יח'" }]
        );
        setSignature(n.foremanSignatureUrl || null);
        setRevisionNote(
          n.rejectionComment || n.revisionComment || "הוחזר לתיקון"
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
    setNoteDate(selected.date.slice(0, 10));
    setClientName(
      selected.clientName ||
        selected.project?.contractor ||
        selected.project?.name ||
        ""
    );
    setAddress(selected.address || selected.project?.location || "");
    const v = selected.vehicles?.[0];
    if (v) {
      setVehicleNumber(v.plate || v.name || "");
      setDriverName(v.driverName || "");
    }
  }, [selected, reviseId]);

  useEffect(() => {
    if (!projectId || selected || reviseId) return;
    const p = projects.find((x) => x.id === projectId);
    if (p) {
      if (!clientName) setClientName(p.contractor || p.name);
      if (!address && p.location) setAddress(p.location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function validLines() {
    return lines.filter((l) => l.description.trim());
  }

  function buildItems() {
    return validLines().map((l, i) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity) || 1,
      unit: l.unit || "יח'",
      sortOrder: i,
    }));
  }

  async function requestSave(mode: "draft" | "submit") {
    setError("");
    if (!clientName.trim()) {
      setError("יש להזין שם לקוח");
      return;
    }
    if (!validLines().length) {
      setError("הוסף לפחות פריט אחד");
      return;
    }
    if (mode === "submit" && !signature) {
      setError("נדרשת חתימה לפני שליחה לאישור");
      return;
    }
    if (mode === "submit") {
      try {
        const gate = await requireAttendanceForAction("delivery");
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
      const items = buildItems();
      let noteId = reviseId;

      const payload = {
        projectId: projectId || null,
        noteDate,
        clientName: clientName.trim(),
        address: address.trim() || null,
        vehicleNumber: vehicleNumber.trim() || null,
        driverName: driverName.trim() || null,
        notes: notes.trim() || null,
        items,
        foremanSignatureUrl: signature,
      };

      if (reviseId) {
        await opsDeliveryNotesService.update(reviseId, payload);
      } else {
        const note = await opsDeliveryNotesService.create(payload);
        noteId = note.id;
      }

      if (!noteId) throw new Error("שגיאה ביצירת תעודה");

      if (!reviseId && photos.length) {
        for (const file of photos.slice(0, 12)) {
          try {
            const form = new FormData();
            form.append("file", file);
            form.append("stage", photoStage);
            await fetch(`/api/field/ops-delivery-notes/${noteId}/media`, {
              method: "POST",
              body: form,
            });
          } catch {
            /* optional */
          }
        }
      }

      if (mode === "submit") {
        if (!approverIds?.length) throw new Error("יש לבחור לפחות מאשר אחד");
        await opsDeliveryNotesService.submit(noteId, approverIds);
        router.replace("/field/delivery-notes");
      } else {
        router.replace("/field/delivery-notes");
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
          {reviseId ? "תיקון תעודה" : "תעודת משלוח חדשה"}
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
              >
                <option value="">ללא / בחרו פרויקט</option>
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
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">לקוח</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={field.input}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">כתובת</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">רכב</span>
          <input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            className={field.input}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">נהג</span>
          <input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className={field.input}
          />
        </label>

        {lines.map((line, idx) => (
          <div key={idx} className={cn(field.card, "space-y-3")}>
            <input
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, description: e.target.value };
                setLines(next);
              }}
              placeholder="תיאור פריט"
              className={field.input}
            />
            <div className="flex gap-3">
              <input
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
                inputMode="decimal"
                placeholder="כמות"
                className={cn(field.input, "w-28")}
              />
              <input
                value={line.unit}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, unit: e.target.value };
                  setLines(next);
                }}
                placeholder="יח'"
                className={cn(field.input, "w-24")}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setLines([
              ...lines,
              { description: "", quantity: "1", unit: "יח'" },
            ])
          }
          className="w-full rounded-2xl border border-dashed border-[#E5E7EB] bg-white py-4 text-lg font-bold text-[#6B7280]"
        >
          + הוסף פריט
        </button>

        <label className="block space-y-2">
          <span className="text-lg font-bold text-[#111827]">הערות</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={field.input}
          />
        </label>

        {!reviseId && (
          <FieldMediaCapture
            label="תמונות"
            files={photos}
            onChange={setPhotos}
            stage={photoStage}
            onStageChange={setPhotoStage}
            stages={DN_PHOTO_STAGES}
          />
        )}

        <div className={cn(field.card, "p-3")}>
          <p className="mb-2 text-lg font-bold text-[#111827]">
            חתימת יוצר המסמך
          </p>
          <p className="mb-2 text-sm text-slate-500">
            חובה לפני שליחה לאישור
          </p>
          <SignaturePad value={signature} onChange={setSignature} height={160} />
        </div>

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
        projectId={projectId || null}
        busy={busy}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(ids) => void doSave("submit", ids)}
      />
    </div>
  );
}
