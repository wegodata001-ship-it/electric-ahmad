"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";

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

export function HubCreateDiaryModal({
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
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [workSummary, setWorkSummary] = useState("");
  const [tasks, setTasks] = useState("");
  const [workers, setWorkers] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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

  const canSave = useMemo(
    () => Boolean(projectId && foremanId),
    [projectId, foremanId]
  );

  async function save(assign: boolean) {
    if (!projectId || !foremanId) {
      setError("יש לבחור פרויקט ומנהל שטח");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const site = sites.find((s) => s.id === siteId);
      const created = await apiClient.post<{
        diary?: { id: string };
        id?: string;
      }>("/api/work-diaries", {
        projectId,
        workSiteId: siteId || null,
        customSiteName: site?.name ?? null,
        clientName: client?.name ?? null,
        address: site?.address ?? project?.location ?? null,
        foremanId,
        workDate,
        workSummary: workSummary || null,
        notes: notes || null,
        workItems: tasks
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((description) => ({ description, unit: "יח'", quantity: 0 })),
        workers: workers
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        assign,
      });
      const diary = created.diary ?? created;
      const diaryId = "id" in diary ? String(diary.id) : "";
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        await fetch(`/api/work-diaries/${diaryId}/attachments`, {
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
            <h2 className="text-lg font-bold text-slate-900">הפקת יומן עבודה</h2>
            <p className="text-sm text-slate-500">היומן יישמר בפרויקט שנבחר</p>
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
          <Field label="תאריך עבודה">
            <input type="date" className={inputCls} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          </Field>
          <Field label="מנהל שטח">
            <select className={inputCls} value={foremanId} onChange={(e) => setForemanId(e.target.value)}>
              <option value="">בחר מנהל שטח</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="משימות">
            <textarea className={inputCls} rows={3} placeholder="שורה לכל משימה" value={tasks} onChange={(e) => setTasks(e.target.value)} />
          </Field>
          <Field label="תיאור עבודה">
            <textarea className={inputCls} rows={2} value={workSummary} onChange={(e) => setWorkSummary(e.target.value)} />
          </Field>
          <Field label="עובדים">
            <textarea className={inputCls} rows={2} placeholder="שורה לכל עובד" value={workers} onChange={(e) => setWorkers(e.target.value)} />
          </Field>
          <Field label="הערות">
            <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="תמונות">
            <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={saving || !canSave} onClick={() => void save(true)}>
            שמור ושלח למנהל שטח
          </Button>
          <Button variant="secondary" disabled={saving || !canSave} onClick={() => void save(false)}>
            שמור טיוטה
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
