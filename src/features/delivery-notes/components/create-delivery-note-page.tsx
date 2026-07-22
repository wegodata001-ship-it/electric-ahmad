"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, Modal } from "@/components/ui";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import { clientService } from "@/features/clients/services/client.service";
import { projectService } from "@/services";
import type { Client, Project } from "@/types";
import { ArrowRight, Pencil, Plus, Search, Trash2, Paperclip, UserPlus } from "lucide-react";
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

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CreateDeliveryNotePage({
  embedded = false,
  lockedProjectId,
  onComplete,
}: {
  embedded?: boolean;
  lockedProjectId?: string;
  onComplete?: (noteId: string) => void;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectFromQuery = lockedProjectId || searchParams.get("projectId") || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientFieldsLocked, setClientFieldsLocked] = useState(false);
  const clientPickerRef = useRef<HTMLDivElement>(null);

  const [noteNumber, setNoteNumber] = useState("…");
  const [noteNumberManual, setNoteNumberManual] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"draft" | "sent" | "delivered">("draft");
  const [client, setClient] = useState("");
  const [clientNumber, setClientNumber] = useState("");
  const [projectId, setProjectId] = useState(projectFromQuery);
  const [orderNumber, setOrderNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [showMoreClient, setShowMoreClient] = useState(false);
  const [showMoreProject, setShowMoreProject] = useState(false);

  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [externalCarrier, setExternalCarrier] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [driverNotes, setDriverNotes] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receivedAt, setReceivedAt] = useState("");

  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine(), emptyLine()]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [saveAsClient, setSaveAsClient] = useState(true);
  const [oneTimeOnly, setOneTimeOnly] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    phoneSecondary: "",
    address: "",
    city: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([projectService.getAll(), clientService.getAll()]).then(
      ([projectList, clientList]) => {
        setProjects(projectList);
        setClients(clientList);
        const pid = projectFromQuery || projectId;
        if (pid) {
          const project = projectList.find((p) => p.id === pid);
          if (project) applyProject(project, clientList);
        }
      }
    );
    deliveryNoteService.getNextNumber().then((n) => setNoteNumber(n.noteNumber));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!clientPickerRef.current?.contains(e.target as Node)) {
        setClientMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 12);
    return clients
      .filter((c) => {
        const hay = [
          c.name,
          c.companyName,
          c.contactName,
          c.phone,
          c.phoneSecondary,
          c.clientNumber,
          c.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [clients, clientQuery]);

  function applyClientCard(card: Client, lock = true) {
    setClientId(card.id);
    setClient(card.name);
    setClientNumber(card.clientNumber ?? "");
    setContactName(card.contactName ?? "");
    setPhone(card.phone ?? "");
    setPhoneSecondary(card.phoneSecondary ?? "");
    setAddress(card.address ?? "");
    setCity(card.city ?? "");
    setNotes(card.notes ?? "");
    setClientQuery(card.name);
    setClientFieldsLocked(lock);
    setClientMenuOpen(false);
  }

  function clearClientSelection() {
    setClientId(null);
    setClientFieldsLocked(false);
    setClient("");
    setClientNumber("");
    setClientQuery("");
    setContactName("");
    setPhone("");
    setPhoneSecondary("");
    setAddress("");
    setCity("");
    setNotes("");
  }

  function applyProject(project: Project, clientList = clients) {
    setProjectId(project.id);
    setOrderNumber(project.contractNumber || "");
    setContactName(project.foremanName || "");
    setAddress(project.location || "");
    setDestination(project.name);
    setDestinationAddress(project.location || "");

    const contractor = project.contractor?.trim();
    if (contractor) {
      const match = clientList.find(
        (c) =>
          c.name.trim().toLowerCase() === contractor.toLowerCase() ||
          (c.companyName &&
            c.companyName.trim().toLowerCase() === contractor.toLowerCase())
      );
      if (match) {
        applyClientCard(match);
      } else {
        setClient(contractor);
        setClientQuery(contractor);
        setClientId(null);
        setClientFieldsLocked(false);
      }
    }
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  async function handleNewClientSubmit() {
    if (!newClientForm.name.trim()) {
      setError("שם לקוח חובה");
      return;
    }
    setNewClientSaving(true);
    setError(null);
    try {
      const snapshot = { ...newClientForm };
      if (saveAsClient && !oneTimeOnly) {
        const created = await clientService.create({
          name: snapshot.name,
          contactName: snapshot.contactName,
          phone: snapshot.phone,
          phoneSecondary: snapshot.phoneSecondary,
          address: snapshot.address,
          city: snapshot.city,
          notes: snapshot.notes,
        });
        setClients((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "he"))
        );
        applyClientCard(created);
      } else {
        setClientId(null);
        setClient(snapshot.name);
        setClientQuery(snapshot.name);
        setContactName(snapshot.contactName);
        setPhone(snapshot.phone);
        setPhoneSecondary(snapshot.phoneSecondary);
        setAddress(snapshot.address);
        setCity(snapshot.city);
        setNotes(snapshot.notes);
        setClientFieldsLocked(false);
      }
      setNewClientOpen(false);
      setNewClientForm({
        name: "",
        contactName: "",
        phone: "",
        phoneSecondary: "",
        address: "",
        city: "",
        notes: "",
      });
      setSaveAsClient(true);
      setOneTimeOnly(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת לקוח");
    } finally {
      setNewClientSaving(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      if (!client.trim()) {
        throw new Error("יש לבחור או להזין לקוח");
      }
      const activeLines = lines.filter((l) => l.description.trim());
      if (activeLines.length === 0) {
        throw new Error("יש למלא לפחות פריט אחד עם תיאור");
      }

      const note = await deliveryNoteService.create({
        noteNumber: noteNumberManual ? noteNumber : undefined,
        date,
        status,
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
        receiverName: receiverName || undefined,
        receivedAt: receivedAt || undefined,
        driverName: includeDelivery ? driverName : undefined,
        driverPhone: includeDelivery ? driverPhone : undefined,
        vehicle: includeDelivery ? vehicle : undefined,
        vehicleNumber: includeDelivery ? vehicleNumber : undefined,
        externalCarrier: includeDelivery ? externalCarrier : undefined,
        deliveryTime: includeDelivery ? deliveryTime : undefined,
        destination: includeDelivery ? destination : undefined,
        destinationAddress: includeDelivery ? destinationAddress : undefined,
        driverNotes: includeDelivery ? driverNotes : undefined,
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
        await deliveryNoteService.uploadAttachment(note.id, file);
      }

      if (onComplete) {
        onComplete(note.id);
      } else {
        router.push(`/delivery-notes/${note.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  const clientReadonly = Boolean(clientId && clientFieldsLocked);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {!embedded && (
            <button
              onClick={() => router.push("/delivery-notes")}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לתעודות משלוח
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">תעודת משלוח חדשה</h1>
          <p className="text-sm text-gray-500 mt-1">מספר תעודה: {noteNumber}</p>
        </div>
        <Button onClick={handleSave} loading={saving} className="min-h-11">
          שמור תעודה
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold text-gray-900 mb-4">פרטי התעודה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="מספר תעודה">
            <div className="flex gap-2 items-center">
              <Input
                value={noteNumber}
                onChange={(e) => setNoteNumber(e.target.value)}
                disabled={!noteNumberManual}
                placeholder="מספר אוטומטי..."
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={noteNumberManual}
                  onChange={(e) => setNoteNumberManual(e.target.checked)}
                />
                ידני
              </label>
            </div>
          </Field>
          <Field label="תאריך *">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="סטטוס">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg"
            >
              <option value="draft">טיוטה</option>
              <option value="sent">נשלח</option>
              <option value="delivered">נמסר</option>
            </select>
          </Field>
          <Field label="הערות" className="md:col-span-2 lg:col-span-3">
            <Input
              value={notes}
              placeholder="הערות כלליות..."
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">פרטי לקוח</h2>
          {!showMoreClient && (
            <button
              type="button"
              onClick={() => setShowMoreClient(true)}
              className="text-xs text-blue-700 hover:underline"
            >
              הצג פרטים נוספים ▼
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="בחר לקוח *" className="md:col-span-2 lg:col-span-2">
            <div className="flex gap-2 items-start">
              <div className="relative flex-1" ref={clientPickerRef}>
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  value={clientQuery}
                  placeholder="בחר לקוח..."
                  className="pr-9"
                  onFocus={() => setClientMenuOpen(true)}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                    setClientMenuOpen(true);
                    if (clientId) {
                      setClientId(null);
                      setClientFieldsLocked(false);
                    }
                    setClient(e.target.value);
                  }}
                />
                {clientMenuOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredClients.length === 0 ? (
                      <p className="px-3 py-2.5 text-sm text-gray-500">
                        לא נמצאו לקוחות — ניתן ליצור לקוח חדש
                      </p>
                    ) : (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-right px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          onClick={() => applyClientCard(c)}
                        >
                          <span className="font-medium text-gray-900 block">
                            {c.name}
                            {c.clientNumber ? (
                              <span className="text-gray-400 font-normal mr-2">
                                #{c.clientNumber}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-gray-500">
                            {[c.companyName, c.contactName, c.phone, c.city]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-9"
                onClick={() => {
                  setNewClientForm((f) => ({
                    ...f,
                    name: clientQuery && !clientId ? clientQuery : f.name,
                  }));
                  setNewClientOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                לקוח חדש
              </Button>
            </div>
            {clientId && (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                <span>לקוח מקושר לכרטיס במערכת</span>
                <button
                  type="button"
                  className="text-blue-700 hover:underline"
                  onClick={clearClientSelection}
                >
                  נקה בחירה
                </button>
              </div>
            )}
          </Field>

          <Field label="טלפון">
            <Input
              value={phone}
              placeholder="טלפון..."
              disabled={clientReadonly}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          {showMoreClient && (
            <>
              <LockedField
                label="איש קשר"
                locked={clientReadonly}
                onEdit={() => setClientFieldsLocked(false)}
              >
                <Input
                  value={contactName}
                  placeholder="בחר איש קשר..."
                  disabled={clientReadonly}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </LockedField>

              <LockedField
                label="טלפון נוסף"
                locked={clientReadonly}
                onEdit={() => setClientFieldsLocked(false)}
              >
                <Input
                  value={phoneSecondary}
                  placeholder="טלפון נוסף..."
                  disabled={clientReadonly}
                  onChange={(e) => setPhoneSecondary(e.target.value)}
                />
              </LockedField>

              <LockedField
                label="כתובת מלאה"
                locked={clientReadonly}
                onEdit={() => setClientFieldsLocked(false)}
                className="md:col-span-2"
              >
                <Input
                  value={address}
                  placeholder="בחר כתובת..."
                  disabled={clientReadonly}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </LockedField>

              <LockedField
                label="עיר"
                locked={clientReadonly}
                onEdit={() => setClientFieldsLocked(false)}
              >
                <Input
                  value={city}
                  placeholder="עיר..."
                  disabled={clientReadonly}
                  onChange={(e) => setCity(e.target.value)}
                />
              </LockedField>
            </>
          )}
        </div>
        {showMoreClient && (
          <button
            type="button"
            onClick={() => setShowMoreClient(false)}
            className="text-xs text-gray-500 hover:text-gray-700 mt-3"
          >
            הסתר פרטים נוספים ▲
          </button>
        )}
      </Card>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">פרטי פרויקט</h2>
          {!showMoreProject && (
            <button
              type="button"
              onClick={() => setShowMoreProject(true)}
              className="text-xs text-blue-700 hover:underline"
            >
              הצג פרטי פרויקט ▼
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="פרויקט (אופציונלי)" className="md:col-span-2 lg:col-span-2">
            <select
              value={projectId}
              disabled={Boolean(lockedProjectId)}
              onChange={(e) => {
                const id = e.target.value;
                setProjectId(id);
                if (id) {
                  const project = projects.find((p) => p.id === id);
                  if (project) applyProject(project, clients);
                }
              }}
              className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg disabled:bg-gray-50"
            >
              <option value="">בחר פרויקט...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          {showMoreProject && projectId && (
            <>
              <Field label="מספר הזמנה / מספר עבודה">
                <Input
                  value={orderNumber}
                  placeholder="מספר הזמנה..."
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </Field>
              <Field label="יעד">
                <Input
                  value={destination}
                  placeholder="יעד משלוח..."
                  onChange={(e) => setDestination(e.target.value)}
                />
              </Field>
              <Field label="כתובת יעד" className="md:col-span-2 lg:col-span-2">
                <Input
                  value={destinationAddress}
                  placeholder="בחר כתובת..."
                  onChange={(e) => setDestinationAddress(e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        {showMoreProject && (
          <button
            type="button"
            onClick={() => setShowMoreProject(false)}
            className="text-xs text-gray-500 hover:text-gray-700 mt-3"
          >
            הסתר פרטי פרויקט ▲
          </button>
        )}
      </Card>

      <Card padding="lg">
        <h2 className="text-base font-semibold text-gray-900 mb-4">כתובת</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LockedField
            label="כתובת מלאה"
            locked={clientReadonly}
            onEdit={() => setClientFieldsLocked(false)}
          >
            <Input
              value={address}
              placeholder="בחר כתובת..."
              disabled={clientReadonly}
              onChange={(e) => setAddress(e.target.value)}
            />
          </LockedField>
          <LockedField
            label="עיר"
            locked={clientReadonly}
            onEdit={() => setClientFieldsLocked(false)}
          >
            <Input
              value={city}
              placeholder="עיר..."
              disabled={clientReadonly}
              onChange={(e) => setCity(e.target.value)}
            />
          </LockedField>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id="includeDelivery"
          checked={includeDelivery}
          onChange={(e) => setIncludeDelivery(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="includeDelivery" className="text-gray-700 cursor-pointer">
          ✓ כולל פרטי הובלה
        </label>
      </div>

      {includeDelivery && (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-gray-900 mb-4">פרטי הובלה</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="נהג">
              <Input
                value={driverName}
                placeholder="שם נהג..."
                onChange={(e) => setDriverName(e.target.value)}
              />
            </Field>
            <Field label="רכב">
              <Input
                value={vehicle}
                placeholder="סוג רכב..."
                onChange={(e) => setVehicle(e.target.value)}
              />
            </Field>
            <Field label="מספר רכב">
              <Input
                value={vehicleNumber}
                placeholder="מספר רכב..."
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </Field>
            <Field label="טלפון">
              <Input
                value={driverPhone}
                placeholder="טלפון נהג..."
                onChange={(e) => setDriverPhone(e.target.value)}
              />
            </Field>
            <Field label="שעת מסירה">
              <Input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
              />
            </Field>
            <Field label="מוביל חיצוני">
              <label className="flex items-center gap-2 h-9 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={externalCarrier}
                  onChange={(e) => setExternalCarrier(e.target.checked)}
                />
                כן
              </label>
            </Field>
            <Field label="הערות לנהג" className="md:col-span-2 lg:col-span-3">
              <Input
                value={driverNotes}
                placeholder="הערות לנהג..."
                onChange={(e) => setDriverNotes(e.target.value)}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">פריטים</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף שורה
          </Button>
        </div>
        <div className="space-y-3 p-3 md:hidden">
          {lines.map((line, index) => (
            <div key={index} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  פריט {index + 1}
                </p>
                <button
                  type="button"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  aria-label="מחיקת פריט"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Field label="מק״ט">
                  <Input
                    value={line.sku}
                    onChange={(e) => updateLine(index, { sku: e.target.value })}
                  />
                </Field>
                <Field label="תיאור">
                  <Input
                    value={line.description}
                    onChange={(e) =>
                      updateLine(index, { description: e.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="יחידה">
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(index, { unit: e.target.value })}
                      className="h-11 w-full px-2 text-sm border border-gray-200 rounded-lg"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="כמות">
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, { quantity: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="ארגז / חבילה">
                  <Input
                    value={line.packageNumber}
                    onChange={(e) =>
                      updateLine(index, { packageNumber: e.target.value })
                    }
                  />
                </Field>
                <Field label="הערות">
                  <Input
                    value={line.notes}
                    onChange={(e) => updateLine(index, { notes: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-3">מק״ט</th>
                <th className="text-right px-3 py-3">תיאור</th>
                <th className="text-right px-3 py-3">יחידה</th>
                <th className="text-right px-3 py-3">כמות</th>
                <th className="text-right px-3 py-3">ארגז / חבילה</th>
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
        <h2 className="text-base font-semibold text-gray-900 mb-4">חתימות</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="שם מקבל">
            <Input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
            />
          </Field>
          <Field label="תאריך קבלה">
            <Input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          חתימה דיגיטלית תתווסף בעתיד — כרגע סימון ואישור בלבד.
        </p>
      </Card>

      <Card padding="lg">
        <h2 className="text-base font-semibold text-gray-900 mb-3">קבצים מצורפים</h2>
        <p className="text-xs text-gray-500 mb-3">תמונות, PDF ומסמכים — יישמרו עם התעודה</p>
        <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
          <Paperclip className="h-4 w-4 text-gray-500" />
          בחירת קבצים
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPendingFiles((prev) => [...prev, ...files]);
            }}
          />
        </label>
        {pendingFiles.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            {pendingFiles.map((f, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <button
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

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          שמור תעודת משלוח
        </Button>
      </div>

      <Modal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        title="לקוח חדש"
        description="מלא פרטים והחלט אם לשמור כרטיס קבוע או רק לתעודה זו"
        size="md"
      >
        <div className="space-y-3">
          <Field label="שם *">
            <Input
              value={newClientForm.name}
              placeholder="שם לקוח..."
              onChange={(e) =>
                setNewClientForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <Field label="איש קשר">
            <Input
              value={newClientForm.contactName}
              placeholder="בחר איש קשר..."
              onChange={(e) =>
                setNewClientForm((f) => ({ ...f, contactName: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="טלפון">
              <Input
                value={newClientForm.phone}
                placeholder="טלפון..."
                onChange={(e) =>
                  setNewClientForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </Field>
            <Field label="טלפון נוסף">
              <Input
                value={newClientForm.phoneSecondary}
                placeholder="טלפון נוסף..."
                onChange={(e) =>
                  setNewClientForm((f) => ({
                    ...f,
                    phoneSecondary: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="כתובת">
            <Input
              value={newClientForm.address}
              placeholder="בחר כתובת..."
              onChange={(e) =>
                setNewClientForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </Field>
          <Field label="עיר">
            <Input
              value={newClientForm.city}
              placeholder="עיר..."
              onChange={(e) =>
                setNewClientForm((f) => ({ ...f, city: e.target.value }))
              }
            />
          </Field>
          <Field label="הערות">
            <Input
              value={newClientForm.notes}
              placeholder="הערות..."
              onChange={(e) =>
                setNewClientForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>

          <div className="space-y-2 pt-1 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={saveAsClient && !oneTimeOnly}
                onChange={(e) => {
                  setSaveAsClient(e.target.checked);
                  if (e.target.checked) setOneTimeOnly(false);
                }}
              />
              שמור כלקוח חדש
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={oneTimeOnly}
                onChange={(e) => {
                  setOneTimeOnly(e.target.checked);
                  if (e.target.checked) setSaveAsClient(false);
                }}
              />
              השתמש רק עבור תעודה זו
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNewClientOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleNewClientSubmit} loading={newClientSaving}>
              אישור
            </Button>
          </div>
        </div>
      </Modal>
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

function LockedField({
  label,
  children,
  locked,
  onEdit,
  className,
}: {
  label: string;
  children: React.ReactNode;
  locked: boolean;
  onEdit: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        {locked && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
          >
            <Pencil className="h-3 w-3" />
            ערוך
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
