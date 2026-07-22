"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Save } from "lucide-react";
import {
  deliveryNoteService,
  type CreateDeliveryNotePayload,
} from "@/features/delivery-notes/services/delivery-note.service";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";
import { projectService } from "@/services";
import type { DeliveryNote } from "@/types";
import { Button, ConfirmationDialog, Input, useToast } from "@/components/ui";

type Line = {
  key: string;
  quantity: string;
  unit: string;
  description: string;
  notes: string;
};

function emptyLine(): Line {
  return {
    key: crypto.randomUUID(),
    quantity: "1",
    unit: "יח'",
    description: "",
    notes: "",
  };
}

type Props = {
  projectId: string;
  /** Edit existing note; omit for create */
  noteId?: string | null;
  /** Called after save — keep modal open for continued editing */
  onSaved: (note: DeliveryNote) => void;
  /** Called after complete (lock) */
  onCompleted: (note: DeliveryNote) => void;
  onCancel: () => void;
};

export function DeliveryNoteForm({
  projectId,
  noteId: initialNoteId,
  onSaved,
  onCompleted,
  onCancel,
}: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(initialNoteId ?? null);
  const [loading, setLoading] = useState(Boolean(initialNoteId));
  const [locked, setLocked] = useState(false);
  const [noteNumber, setNoteNumber] = useState("יוקצה בשמירה");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [receiverName, setReceiverName] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [receiverSignatureUrl, setReceiverSignatureUrl] = useState<string | null>(
    null
  );
  const [employeeSignatureUrl, setEmployeeSignatureUrl] = useState<string | null>(
    null
  );
  const [employeeSignedName, setEmployeeSignedName] = useState("");

  useEffect(() => {
    setCurrentId(initialNoteId ?? null);
  }, [initialNoteId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (initialNoteId) {
          const note = await deliveryNoteService.getById(initialNoteId);
          if (cancelled) return;
          applyNote(note);
        } else {
          const [seq, project] = await Promise.all([
            deliveryNoteService.getNextNumber(),
            projectService.getById(projectId),
          ]);
          if (cancelled) return;
          setNoteNumber(seq.noteNumber);
          setLocked(false);
          if (project) {
            setProjectName(project.name);
            setClient(project.contractor || "");
            setAddress(project.location || "");
            setContactName(project.foremanName || "");
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שגיאה בטעינה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, projectId]);

  function applyNote(note: DeliveryNote) {
    setCurrentId(note.id);
    setNoteNumber(note.noteNumber);
    setDate(note.date.slice(0, 10));
    setProjectName(note.projectName || "");
    setClient(note.client || "");
    setAddress(
      [note.address, note.city].filter(Boolean).join(", ") || note.address || ""
    );
    setContactName(note.contactName || "");
    setPhone(note.phone || "");
    setVehicleNumber(note.vehicleNumber || note.vehicle || "");
    setNotes(note.notes || "");
    setReceiverName(note.receiverName || "");
    setReceivedAt(note.receivedAt ? note.receivedAt.slice(0, 10) : "");
    setReceiverSignatureUrl(note.receiverSignatureUrl || null);
    setEmployeeSignatureUrl(note.employeeSignatureUrl || null);
    setEmployeeSignedName(note.employeeSignedName || "");
    setLocked(
      note.status === "locked" ||
        note.status === "sent" ||
        note.status === "delivered" ||
        note.status === "cancelled"
    );
    setLines(
      note.items.length
        ? note.items.map((item) => ({
            key: item.id,
            quantity: String(item.quantity),
            unit: item.unit || "יח'",
            description: item.description,
            notes: item.notes || "",
          }))
        : [emptyLine()]
    );
  }

  function buildPayload(): CreateDeliveryNotePayload | null {
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        unit: l.unit.trim() || "יח'",
        quantity: Number(l.quantity) || 0,
        notes: l.notes.trim() || undefined,
      }));

    if (!client.trim()) {
      toast.error("לקוח חובה");
      return null;
    }
    if (!items.length) {
      toast.error("יש להוסיף לפחות פריט אחד");
      return null;
    }
    if (items.some((i) => !(i.quantity > 0))) {
      toast.error("כמות חייבת להיות חיובית");
      return null;
    }

    return {
      date,
      status: "draft",
      client: client.trim(),
      projectId,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      vehicleNumber: vehicleNumber.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      receivedAt: receivedAt || undefined,
      receiverSignatureUrl,
      employeeSignatureUrl,
      employeeSignedName: employeeSignedName.trim() || undefined,
      senderSigned: Boolean(employeeSignatureUrl),
      receiverSigned: Boolean(receiverSignatureUrl),
      items,
    };
  }

  async function handleSave(): Promise<DeliveryNote | null> {
    if (locked) return null;
    const payload = buildPayload();
    if (!payload) return null;

    setSaving(true);
    try {
      const note = currentId
        ? await deliveryNoteService.update(currentId, payload)
        : await deliveryNoteService.create(payload);
      applyNote(note);
      toast.success(currentId ? "התעודה נשמרה" : "תעודת משלוח נוצרה");
      onSaved(note);
      return note;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      let id = currentId;
      if (!locked) {
        const saved = await handleSave();
        if (!saved) return;
        id = saved.id;
      }
      if (!id) {
        toast.error("יש לשמור את התעודה לפני הסיום");
        return;
      }
      const result = await deliveryNoteService.complete(id);
      applyNote(result.note);
      setConfirmComplete(false);
      toast.success("התעודה הושלמה ונשמרה במסמכי הפרויקט");
      onCompleted(result.note);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בסיום");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500">טוען…</p>;
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-6" dir="rtl">
      {locked && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          התעודה הושלמה ונעולה לעריכה
        </p>
      )}
      {/* Document-like header fields */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <h3 className="text-sm font-bold text-gray-900">פרטי התעודה</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="מספר תעודה">
            <Input value={noteNumber} disabled className="bg-white" />
          </Field>
          <Field label="תאריך">
            <Input
              type="date"
              value={date}
              disabled={locked}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="פרויקט">
            <Input value={projectName} disabled className="bg-white" />
          </Field>
          <Field label="לקוח">
            <Input
              value={client}
              disabled={locked}
              onChange={(e) => setClient(e.target.value)}
              required
            />
          </Field>
          <Field label="כתובת">
            <Input
              value={address}
              disabled={locked}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <Field label="איש קשר">
            <Input
              value={contactName}
              disabled={locked}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label="טלפון">
            <Input
              value={phone}
              disabled={locked}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label="מספר רכב (אופציונלי)">
            <Input
              value={vehicleNumber}
              disabled={locked}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
          </Field>
          <Field label="הערות" className="sm:col-span-2 lg:col-span-3">
            <textarea
              disabled={locked}
              className="min-h-[72px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Items table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">טבלת פריטים</h3>
          {!locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="h-4 w-4" />
              הוסף שורה
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-primary-700 text-white">
              <tr>
                <th className="w-24 px-3 py-2.5 text-right font-semibold">כמות</th>
                <th className="w-24 px-3 py-2.5 text-right font-semibold">יחידה</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  תיאור הפריט
                </th>
                <th className="w-48 px-3 py-2.5 text-right font-semibold">הערות</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-t border-gray-100">
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      disabled={locked}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      disabled={locked}
                      value={line.unit}
                      onChange={(e) =>
                        updateLine(line.key, { unit: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      disabled={locked}
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      placeholder="תיאור הפריט"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      disabled={locked}
                      value={line.notes}
                      onChange={(e) =>
                        updateLine(line.key, { notes: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    {!locked && (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-40"
                        disabled={lines.length <= 1}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.key !== line.key)
                          )
                        }
                        aria-label="מחק שורה"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Signatures */}
      <section className="space-y-3 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900">חתימות</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="שם מקבל">
            <Input
              value={receiverName}
              disabled={locked}
              onChange={(e) => setReceiverName(e.target.value)}
            />
          </Field>
          <Field label="תאריך קבלה">
            <Input
              type="date"
              value={receivedAt}
              disabled={locked}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </Field>
          {locked ? (
            receiverSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receiverSignatureUrl}
                alt="חתימת מקבל"
                className="max-h-28 rounded-xl border border-gray-200 bg-white object-contain"
              />
            ) : (
              <p className="text-sm text-gray-400">אין חתימת מקבל</p>
            )
          ) : (
            <SignaturePad
              label="חתימת מקבל"
              value={receiverSignatureUrl}
              onChange={setReceiverSignatureUrl}
            />
          )}
          <div className="space-y-3">
            <Field label="שם עובד חותם">
              <Input
                value={employeeSignedName}
                disabled={locked}
                onChange={(e) => setEmployeeSignedName(e.target.value)}
              />
            </Field>
            {locked ? (
              employeeSignatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employeeSignatureUrl}
                  alt="חתימת עובד"
                  className="max-h-28 rounded-xl border border-gray-200 bg-white object-contain"
                />
              ) : (
                <p className="text-sm text-gray-400">אין חתימת עובד</p>
              )
            ) : (
              <SignaturePad
                label="חתימת עובד"
                value={employeeSignatureUrl}
                onChange={setEmployeeSignatureUrl}
              />
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving || completing}
        >
          סגור
        </Button>
        {!locked && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave()}
              disabled={saving || completing}
            >
              <Save className="h-4 w-4" />
              {saving ? "שומר…" : "שמור"}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmComplete(true)}
              disabled={saving || completing}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              סיימתי תעודת משלוח
            </Button>
          </>
        )}
      </div>

      <ConfirmationDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={() => void handleComplete()}
        title="סיום תעודת משלוח"
        description="האם לסיים את תעודת המשלוח? התעודה תינעל לעריכה, יופק PDF והיא תישמר במסמכי הפרויקט."
        confirmLabel="סיימתי"
        loading={completing}
        loadingLabel="שומר…"
        variant="primary"
        icon="clipboard"
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className || ""}`}>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}
