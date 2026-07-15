"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import { projectService } from "@/services";
import type { DeliveryNote, Project } from "@/types";
import { ArrowRight, Plus, Trash2, Paperclip } from "lucide-react";
import { UNITS } from "@/constants";

type Line = {
  sku: string;
  description: string;
  unit: string;
  quantity: string;
  packageNumber: string;
  notes: string;
};

const emptyLine = (): Line => ({
  sku: "",
  description: "",
  unit: "יח'",
  quantity: "1",
  packageNumber: "",
  notes: "",
});

function wasSent(note: DeliveryNote) {
  return Boolean(
    note.emailSentAt ||
      note.whatsappSentAt ||
      note.status === "delivered" ||
      note.status === "in_transit"
  );
}

export function EditDeliveryNotePage({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackSent, setAckSent] = useState(false);

  const [date, setDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [client, setClient] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [externalCarrier, setExternalCarrier] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [driverNotes, setDriverNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      deliveryNoteService.getById(noteId),
      projectService.getAll(),
    ])
      .then(([n, projectList]) => {
        setNote(n);
        setProjects(projectList);
        setDate(n.date.slice(0, 10));
        setDepartureTime(n.departureTime || "");
        setClient(n.client);
        setClientId(n.clientId ?? null);
        setProjectId(n.projectId || "");
        setOrderNumber(n.orderNumber || "");
        setContactName(n.contactName || "");
        setPhone(n.phone || "");
        setPhoneSecondary(n.phoneSecondary || "");
        setAddress(n.address || "");
        setCity(n.city || "");
        setNotes(n.notes || "");
        setDriverName(n.driverName || "");
        setVehicle(n.vehicle || "");
        setVehicleNumber(n.vehicleNumber || "");
        setExternalCarrier(Boolean(n.externalCarrier));
        setDeliveryTime(n.deliveryTime || "");
        setDestination(n.destination || "");
        setDestinationAddress(n.destinationAddress || "");
        setDriverNotes(n.driverNotes || "");
        setLines(
          n.items.length
            ? n.items.map((i) => ({
                sku: i.sku || "",
                description: i.description,
                unit: i.unit || "יח'",
                quantity: String(i.quantity),
                packageNumber: i.packageNumber || "",
                notes: i.notes || "",
              }))
            : [emptyLine()]
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [noteId]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  async function handleSave() {
    if (!note) return;
    if (wasSent(note) && !ackSent) {
      setError("יש לאשר את ההתראה לפני שמירה (תעודה שנשלחה)");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const activeLines = lines.filter((l) => l.description.trim());
      if (!client.trim()) throw new Error("לקוח חובה");
      if (activeLines.length === 0) {
        throw new Error("יש למלא לפחות פריט אחד עם תיאור");
      }

      for (const id of removeAttachmentIds) {
        await deliveryNoteService.deleteAttachment(noteId, id);
      }

      const updated = await deliveryNoteService.update(noteId, {
        noteNumber: note.noteNumber,
        date,
        status: note.status,
        client,
        clientId,
        projectId: projectId || null,
        orderNumber,
        contactName,
        phone,
        phoneSecondary,
        address,
        city,
        notes,
        receiverName: note.receiverName ?? undefined,
        receivedAt: note.receivedAt ?? undefined,
        driverName,
        driverPhone: note.driverPhone ?? undefined,
        vehicle,
        vehicleNumber,
        externalCarrier,
        deliveryTime,
        destination,
        destinationAddress,
        driverNotes,
        items: activeLines.map((l) => ({
          sku: l.sku || undefined,
          description: l.description,
          unit: l.unit,
          quantity: Number(l.quantity) || 0,
          packageNumber: l.packageNumber || undefined,
          notes: l.notes || undefined,
        })),
      });

      for (const file of pendingFiles) {
        await deliveryNoteService.uploadAttachment(noteId, file);
      }

      router.push(`/delivery-notes/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">טוען תעודה לעריכה...</p>;
  }

  if (!note) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error || "תעודה לא נמצאה"}</p>
      </Card>
    );
  }

  const sent = wasSent(note);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push(`/delivery-notes/${noteId}`)}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לתעודה
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            עריכת תעודת משלוח
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            מספר תעודה: {note.noteNumber} (לא ניתן לשינוי) · גרסה נוכחית{" "}
            {note.currentVersion ?? 1}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/delivery-notes/${noteId}`)}
          >
            ביטול
          </Button>
          <Button onClick={handleSave} loading={saving}>
            שמור שינויים
          </Button>
        </div>
      </div>

      {sent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
          <p>
            תעודת המשלוח כבר נשלחה. לאחר השמירה תיווצר גרסה מעודכנת של המסמך
            ותירשם היסטוריית השינויים.
          </p>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={ackSent}
              onChange={(e) => setAckSent(e.target.checked)}
            />
            אני מאשר/ת ומבין/ה שתישמר גרסה מעודכנת
          </label>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold mb-4">פרטי התעודה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="מספר תעודה">
            <Input value={note.noteNumber} disabled />
          </Field>
          <Field label="תאריך *">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="שעת יציאה">
            <Input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
            />
          </Field>
          <Field label="לקוח *">
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="פרויקט">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg"
            >
              <option value="">ללא פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="מספר הזמנה / מספר עבודה">
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </Field>
          <Field label="איש קשר">
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label="טלפון">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="טלפון נוסף">
            <Input
              value={phoneSecondary}
              onChange={(e) => setPhoneSecondary(e.target.value)}
            />
          </Field>
          <Field label="כתובת" className="md:col-span-2">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="עיר">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="הערות" className="md:col-span-2 lg:col-span-3">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card padding="lg">
        <h2 className="text-base font-semibold mb-4">פרטי הובלה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="נהג">
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </Field>
          <Field label="רכב">
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </Field>
          <Field label="מספר רכב">
            <Input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
          </Field>
          <Field label="מוביל חיצוני">
            <label className="flex items-center gap-2 h-9 text-sm">
              <input
                type="checkbox"
                checked={externalCarrier}
                onChange={(e) => setExternalCarrier(e.target.checked)}
              />
              כן
            </label>
          </Field>
          <Field label="שעת מסירה">
            <Input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
            />
          </Field>
          <Field label="יעד">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </Field>
          <Field label="כתובת יעד" className="md:col-span-2">
            <Input
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
          </Field>
          <Field label="הערות לנהג" className="md:col-span-2 lg:col-span-3">
            <Input
              value={driverNotes}
              onChange={(e) => setDriverNotes(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold">פריטים</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף שורה
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-3">מק״ט</th>
                <th className="text-right px-3 py-3">תיאור</th>
                <th className="text-right px-3 py-3">יחידה</th>
                <th className="text-right px-3 py-3">כמות</th>
                <th className="text-right px-3 py-3">ארגז</th>
                <th className="text-right px-3 py-3">הערות</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-gray-50">
                  <td className="px-2 py-2">
                    <Input
                      value={line.sku}
                      onChange={(e) => updateLine(index, { sku: e.target.value })}
                      className="w-28"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(index, { description: e.target.value })
                      }
                      className="min-w-[180px]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(index, { unit: e.target.value })}
                      className="h-9 px-2 text-sm border border-gray-200 rounded-lg"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, { quantity: e.target.value })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.packageNumber}
                      onChange={(e) =>
                        updateLine(index, { packageNumber: e.target.value })
                      }
                      className="w-28"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.notes}
                      onChange={(e) => updateLine(index, { notes: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="lg">
        <h2 className="text-base font-semibold mb-3">קבצים</h2>
        <div className="space-y-2 mb-3">
          {(note.attachments || [])
            .filter((a) => !removeAttachmentIds.includes(a.id))
            .map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm gap-2"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-700 hover:underline truncate"
                >
                  {a.name}
                </a>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    setRemoveAttachmentIds((prev) => [...prev, a.id])
                  }
                >
                  מחק
                </button>
              </div>
            ))}
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
          <Paperclip className="h-4 w-4 text-gray-500" />
          הוסף קבצים
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPendingFiles((prev) => [...prev, ...files]);
            }}
          />
        </label>
        {pendingFiles.length > 0 && (
          <ul className="mt-2 text-sm text-gray-600 space-y-1">
            {pendingFiles.map((f, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-red-500 text-xs"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  הסר
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/delivery-notes/${noteId}`)}
        >
          ביטול
        </Button>
        <Button onClick={handleSave} loading={saving}>
          שמור שינויים
        </Button>
      </div>
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
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
