"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";

type ClientNode = {
  id: string;
  name: string;
  projects: {
    id: string;
    name: string;
    contractor: string;
    location: string;
    sites: { id: string; name: string; address: string | null }[];
  }[];
};
type FieldManager = { id: string; name: string };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm";

export function HubCreateDnModal({
  clients,
  initialProjectId,
  initialSiteId,
  onClose,
  onCreated,
}: {
  clients: ClientNode[];
  initialProjectId?: string;
  initialSiteId?: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [siteId, setSiteId] = useState(initialSiteId ?? "");
  const [foremanId, setForemanId] = useState("");
  const [destination, setDestination] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteTime, setNoteTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [items, setItems] = useState([{ description: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [managers, setManagers] = useState<FieldManager[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const client = clients.find((c) => c.id === clientId);
  const projects = client?.projects ?? [];
  const project = projects.find((p) => p.id === projectId) ?? null;
  const sites = project?.sites ?? [];

  useEffect(() => {
    if (initialProjectId) {
      const owner = clients.find((c) =>
        c.projects.some((p) => p.id === initialProjectId)
      );
      if (owner) setClientId(owner.id);
      setProjectId(initialProjectId);
    }
  }, [clients, initialProjectId]);

  useEffect(() => {
    apiClient
      .get<{ items: FieldManager[] }>("/api/work-diaries/field-managers")
      .then((r) => setManagers(r.items ?? []))
      .catch(() => setManagers([]));
  }, []);

  useEffect(() => {
    const site = sites.find((s) => s.id === siteId);
    setDestination((prev) => prev || site?.address || project?.location || client?.name || "");
  }, [client?.name, project?.location, siteId, sites]);

  async function save() {
    if (!projectId) {
      setError("יש לבחור פרויקט");
      return;
    }
    if (!foremanId) {
      setError("יש לבחור מנהל שטח / מוסר");
      return;
    }
    const rows = items.filter((item) => item.description.trim());
    if (!rows.length) {
      setError("יש להוסיף לפחות פריט אחד");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const site = sites.find((s) => s.id === siteId);
      const note = await apiClient.post<{ id: string }>("/api/ops-delivery-notes", {
        projectId,
        workSiteId: siteId || null,
        foremanId,
        clientName: client?.name || project?.contractor || "לקוח",
        address: destination || site?.address || project?.location || null,
        noteDate,
        noteTime,
        notes: notes || null,
        items: rows.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unit: "יח'",
        })),
        foremanSignatureUrl: signature,
      });
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        await fetch(`/api/ops-delivery-notes/${note.id}/attachments`, {
          method: "POST",
          body: data,
        });
      }
      onCreated(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">הפקת תעודת משלוח</h2>
            <p className="text-sm text-slate-500">התעודה תשויך לפרויקט ולארכיון</p>
          </div>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            סגור
          </button>
        </div>
        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="space-y-3">
          <Field label="לקוח">
            <select className={inputCls} value={clientId} onChange={(e) => {
              setClientId(e.target.value);
              setProjectId("");
              setSiteId("");
            }}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="פרויקט">
            <select className={inputCls} value={projectId} onChange={(e) => {
              setProjectId(e.target.value);
              setSiteId("");
            }}>
              <option value="">בחר פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="סניף עבודה">
            <select className={inputCls} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">ללא סניף — ברמת הפרויקט</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="יעד / מקבל">
            <input className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך">
              <input type="date" className={inputCls} value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
            </Field>
            <Field label="שעה">
              <input type="time" className={inputCls} value={noteTime} onChange={(e) => setNoteTime(e.target.value)} />
            </Field>
          </div>
          <Field label="מנהל שטח / מוסר">
            <select className={inputCls} value={foremanId} onChange={(e) => setForemanId(e.target.value)}>
              <option value="">בחר</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">פריטים וכמויות</p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="תיאור"
                    value={item.description}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, description: e.target.value } : row
                        )
                      )
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    className={`${inputCls} w-20`}
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, quantity: Number(e.target.value) || 1 } : row
                        )
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-slate-700"
              onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1 }])}
            >
              + פריט
            </button>
          </div>
          <Field label="הערות">
            <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="תמונות">
            <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </Field>
          <SignaturePad value={signature} onChange={setSignature} height={110} />
        </div>
        <div className="mt-5">
          <Button disabled={saving} onClick={() => void save()}>
            שמור תעודת משלוח
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
