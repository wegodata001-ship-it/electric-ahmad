"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import { opsDeliveryNotesService } from "@/features/work-diaries/services/work-diaries.service";
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
type BoqOpt = { description: string; unit?: string };

const compactInput =
  "w-full min-h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-blue-500";

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
  const [noteTime, setNoteTime] = useState(() =>
    new Date().toTimeString().slice(0, 5)
  );
  const [clientName, setClientName] = useState("");
  const [destTouched, setDestTouched] = useState(false);
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
  const [boqItems, setBoqItems] = useState<BoqOpt[]>([]);
  const [boqOpen, setBoqOpen] = useState(false);

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
        if (n.noteTime) setNoteTime(String(n.noteTime).slice(0, 5));
        setClientName(n.clientName || "");
        setAddress(n.address || "");
        setDestTouched(true);
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
    if (p && !destTouched) {
      if (p.contractor || p.name) setClientName(p.contractor || p.name);
      if (p.location) setAddress(p.location);
    }
    setBoqItems([]);
    if (!projectId) return;
    fetch(`/api/boq?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((json) => {
        const rows = json?.data?.items || json?.data || [];
        if (!Array.isArray(rows)) return;
        setBoqItems(
          rows
            .map((row: { description?: string; unit?: string }) => ({
              description: String(row.description || "").trim(),
              unit: row.unit || "יח'",
            }))
            .filter((row: BoqOpt) => row.description)
            .slice(0, 40)
        );
      })
      .catch(() => setBoqItems([]));
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

  function addLine(preset?: Partial<EquipLine>) {
    setLines((prev) => [
      ...prev,
      {
        description: preset?.description || "",
        quantity: preset?.quantity || "1",
        unit: preset?.unit || "יח'",
      },
    ]);
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
        noteTime,
        clientName: clientName.trim(),
        address: address.trim() || clientName.trim() || null,
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

      if (photos.length) {
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

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="overflow-x-hidden pb-24">
      <header className="mb-3">
        <h1 className="text-lg font-black text-[#111827]">
          {reviseId ? "תיקון תעודה" : "תעודת משלוח חדשה"}
        </h1>
        {selectedProject && (
          <p className="mt-0.5 truncate text-sm text-[#6B7280]">
            {selectedProject.name}
          </p>
        )}
      </header>

      {revisionNote && <RevisionFeedbackBanner comment={revisionNote} />}
      {error && <p className={cn(field.error, "mb-3 py-2 text-sm")}>{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">פרטי משלוח</h2>
        {!reviseId && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                פרויקט *
              </span>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (orderId) {
                    const o = orders.find((x) => x.id === orderId);
                    if (o && o.projectId !== e.target.value) setOrderId("");
                  }
                }}
                className={compactInput}
              >
                <option value="">בחר פרויקט</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {orders.length > 0 && (
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className={compactInput}
              >
                <option value="">סידור עבודה (אופציונלי)</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.project?.name || "פרויקט"} ·{" "}
                    {new Date(order.date).toLocaleDateString("he-IL")} ·{" "}
                    {STATUS_LABELS[order.status]}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
            יעד / מקבל
          </span>
          <input
            value={clientName}
            onChange={(e) => {
              setDestTouched(true);
              setClientName(e.target.value);
            }}
            placeholder="שם / כתובת"
            className={compactInput}
          />
        </label>
        <input
          value={address}
          onChange={(e) => {
            setDestTouched(true);
            setAddress(e.target.value);
          }}
          placeholder="כתובת"
          className={compactInput}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            className={compactInput}
          />
          <input
            type="time"
            value={noteTime}
            onChange={(e) => setNoteTime(e.target.value)}
            className={compactInput}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="רכב"
            className={compactInput}
          />
          <input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="נהג"
            className={compactInput}
          />
        </div>
      </section>

      <section className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">פריטים</h2>
          {boqItems.length > 0 && (
            <button
              type="button"
              onClick={() => setBoqOpen((v) => !v)}
              className="text-xs font-bold text-blue-700"
            >
              בחר פריט מהפרויקט
            </button>
          )}
        </div>
        {boqOpen && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white">
            {boqItems.map((item, i) => (
              <button
                key={`${item.description}-${i}`}
                type="button"
                className="block w-full truncate px-3 py-2 text-right text-sm"
                onClick={() => {
                  addLine({ description: item.description, unit: item.unit });
                  setBoqOpen(false);
                }}
              >
                {item.description}
              </button>
            ))}
          </div>
        )}
        {lines.map((line, idx) => (
          <div key={idx} className="flex min-w-0 items-center gap-1.5">
            <input
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, description: e.target.value };
                setLines(next);
              }}
              placeholder="פריט / תיאור"
              className={cn(compactInput, "min-w-0 flex-1")}
            />
            <QtyStepper
              value={line.quantity}
              onChange={(qty) => {
                const next = [...lines];
                next[idx] = { ...line, quantity: String(Math.max(0, qty)) };
                setLines(next);
              }}
            />
            <button
              type="button"
              aria-label="מחק פריט"
              onClick={() =>
                setLines((prev) =>
                  prev.length === 1
                    ? [{ description: "", quantity: "1", unit: "יח'" }]
                    : prev.filter((_, i) => i !== idx)
                )
              }
              className="grid h-10 w-9 shrink-0 place-items-center text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addLine()}
          className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-blue-700"
        >
          <Plus className="h-4 w-4" />
          הוסף פריט
        </button>
      </section>

      <section className="mt-4 space-y-2">
        <h2 className="text-sm font-bold">תיעוד</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="הערות"
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
        />
        <FieldMediaCapture
          compact
          label="תמונות"
          files={photos}
          onChange={setPhotos}
          stage={photoStage}
          onStageChange={setPhotoStage}
          stages={DN_PHOTO_STAGES}
        />
      </section>

      <section className="mt-4 space-y-1.5">
        <h2 className="text-sm font-bold">חתימה</h2>
        <SignaturePad
          value={signature}
          onChange={setSignature}
          label="חתימת מוסר / מקבל"
          placeholder="חתום כאן"
          height={96}
          showClear={false}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white/95 px-3 pt-2 backdrop-blur">
        <div
          className="mx-auto grid max-w-lg grid-cols-2 gap-2"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestSave("draft")}
            className="min-h-11 rounded-lg border border-[#E5E7EB] bg-white text-sm font-bold disabled:opacity-60"
          >
            שמור טיוטה
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestSave("submit")}
            className="min-h-11 rounded-lg bg-emerald-600 text-sm font-bold text-white disabled:opacity-60"
          >
            {reviseId ? "שלח שוב" : "שלח לאישור"}
          </button>
        </div>
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

function QtyStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (qty: number) => void;
}) {
  const n = Number(value) || 0;
  return (
    <div className="flex h-10 shrink-0 items-center rounded-lg border border-[#E5E7EB] bg-white">
      <button
        type="button"
        aria-label="הקטן כמות"
        onClick={() => onChange(n - 1)}
        className="grid h-10 w-8 place-items-center"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        inputMode="decimal"
        aria-label="כמות"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-8 bg-transparent text-center text-sm outline-none"
      />
      <button
        type="button"
        aria-label="הגדל כמות"
        onClick={() => onChange(n + 1)}
        className="grid h-10 w-8 place-items-center"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
