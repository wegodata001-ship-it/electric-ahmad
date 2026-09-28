"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Eye,
  ImageIcon,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import {
  DRIVER_DN_STATUS_LABEL,
  driverDnStatusTone,
} from "@/apps/driver/driver-dn-status";
import { DN_PHOTO_STAGES } from "@/apps/shared/field-media-capture";

type BoqOpt = { id: string; description: string; unit: string };
type Project = {
  id: string;
  name: string;
  location?: string;
  contractor?: string;
};
type Line = { description: string; quantity: string; unit: string };
type ExistingNote = {
  projectId?: string | null;
  address?: string | null;
  clientName?: string | null;
  noteDate?: string | null;
  noteTime?: string | null;
  notes?: string | null;
  price?: string | number | null;
  transportCost?: string | number | null;
  financialNotes?: string | null;
  foremanSignatureUrl?: string | null;
  status?: string | null;
  rejectionComment?: string | null;
  documentNumber?: string | null;
  items?: Array<{
    description?: string | null;
    quantity?: string | number | null;
    unit?: string | null;
  }>;
  media?: Array<{ url?: string | null }>;
};
type SavedNote = { id: string };

type Props = { editId?: string };

const inputClass =
  "w-full min-h-10 rounded-lg border border-[#DCE4EF] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#2563EB] disabled:opacity-60";

export function DriverDnForm({ editId }: Props) {
  const router = useRouter();
  const { userName } = usePortalSession("driver");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [destination, setDestination] = useState("");
  const [destTouched, setDestTouched] = useState(false);
  const [noteDate, setNoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [noteTime, setNoteTime] = useState(() =>
    new Date().toTimeString().slice(0, 5)
  );
  const [lines, setLines] = useState<Line[]>([
    { description: "", quantity: "1", unit: "יח'" },
  ]);
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [financialNotes, setFinancialNotes] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoStage, setPhotoStage] = useState("cargo");
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftSavedHint, setDraftSavedHint] = useState(false);
  const [boqOpen, setBoqOpen] = useState(false);
  const [boqItems, setBoqItems] = useState<BoqOpt[]>([]);

  useEffect(() => {
    apiClient
      .get<{ items: Project[] }>("/api/driver/projects")
      .then((d) => setProjects(d.items || []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!editId) return;
    apiClient
      .get<ExistingNote>(`/api/driver/delivery-notes/${editId}`)
      .then((n) => {
        setProjectId(n.projectId || "");
        setDestination(n.address || n.clientName || "");
        setDestTouched(true);
        setNoteDate(String(n.noteDate || "").slice(0, 10));
        setNoteTime(n.noteTime || "");
        setNotes(n.notes || "");
        setPrice(n.price != null ? String(n.price) : "");
        setTransportCost(
          n.transportCost != null ? String(n.transportCost) : ""
        );
        setFinancialNotes(n.financialNotes || "");
        setSignature(n.foremanSignatureUrl || null);
        setStatus(n.status ?? null);
        setRejection(n.rejectionComment || null);
        setDocNumber(n.documentNumber || null);
        const items = (n.items || []).map((it) => ({
          description: it.description || "",
          quantity: String(it.quantity ?? 1),
          unit: it.unit || "יח'",
        }));
        setLines(
          items.length ? items : [{ description: "", quantity: "1", unit: "יח'" }]
        );
        if (Array.isArray(n.media)) {
          setPhotos(
            n.media
              .map((m) => m.url)
              .filter((url): url is string => Boolean(url))
          );
        }
      })
      .catch((e) => setError(e.message));
  }, [editId]);

  const selectedProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!projectId) {
      setBoqItems([]);
      return;
    }
    apiClient
      .get<{ items: BoqOpt[] }>(
        `/api/driver/projects?projectId=${encodeURIComponent(projectId)}`
      )
      .then((d) => setBoqItems(d.items || []))
      .catch(() => setBoqItems([]));
  }, [projectId]);

  function applyProject(id: string) {
    setProjectId(id);
    const project = projects.find((p) => p.id === id);
    if (!project || destTouched) return;
    const auto = [project.contractor, project.location]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(" · ");
    if (auto) setDestination(auto);
  }

  function addLine(preset?: Partial<Line>) {
    setLines((prev) => [
      ...prev,
      {
        description: preset?.description || "",
        quantity: preset?.quantity || "1",
        unit: preset?.unit || "יח'",
      },
    ]);
  }

  function setQty(idx: number, next: number) {
    const qty = String(Math.max(0, next));
    setLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, quantity: qty } : line))
    );
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url.startsWith("data:image")) {
        setPhotos((p) => [...p, url].slice(0, 6));
      }
    };
    reader.readAsDataURL(file);
  }

  async function save(submit: boolean) {
    setError("");
    const cleanItems = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity) || 0,
        unit: l.unit || "יח'",
      }))
      .filter((l) => l.description && l.quantity > 0);

    if (!destination.trim()) {
      setError("יש להזין יעד");
      return;
    }
    if (!cleanItems.length) {
      setError("יש להוסיף לפחות פריט אחד");
      return;
    }
    if (submit && !signature) {
      setError("יש לחתום לפני שליחה לאישור");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        projectId: projectId || null,
        clientName: destination.trim(),
        address: destination.trim(),
        noteDate,
        noteTime: noteTime || null,
        notes: notes || null,
        price: price !== "" ? price : null,
        transportCost: transportCost !== "" ? transportCost : null,
        financialNotes: financialNotes || null,
        items: cleanItems,
        foremanSignatureUrl: signature,
        foremanSignedName: signature ? userName || "נהג" : null,
        submit: false,
      };

      let note: SavedNote;
      if (editId) {
        note = await apiClient.patch<SavedNote>(
          `/api/driver/delivery-notes/${editId}`,
          payload
        );
      } else {
        note = await apiClient.post<SavedNote>(
          "/api/driver/delivery-notes",
          payload
        );
      }

      const id = note.id as string;
      for (const photo of photos) {
        if (!photo.startsWith("data:image")) continue;
        await apiClient.post(`/api/driver/delivery-notes/${id}/media`, {
          imageBase64: photo,
          stage: photoStage,
          name: "תמונה",
        });
      }

      if (submit) {
        await apiClient.post(`/api/driver/delivery-notes/${id}/submit`);
      } else {
        setDraftSavedHint(true);
        setStatus("draft");
      }

      router.replace(`/driver/delivery-notes/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const editable = !status || status === "draft" || status === "revision";
  const displayStatus = status || (draftSavedHint ? "draft" : "draft");

  return (
    <div className="overflow-x-hidden pb-24">
      <header className="mb-3">
        <h1 className="text-lg font-black text-[#0F172A]">
          {editId ? "עריכת תעודה" : "תעודת משלוח חדשה"}
        </h1>
        {selectedProject && (
          <p className="mt-0.5 truncate text-sm text-[#64748B]">
            {selectedProject.name}
          </p>
        )}
        {docNumber && (
          <p className="text-xs font-semibold text-[#94A3B8]">{docNumber}</p>
        )}
        {(status || draftSavedHint) && (
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${driverDnStatusTone(displayStatus)}`}
          >
            {draftSavedHint && !status
              ? "נשמרה טיוטה"
              : DRIVER_DN_STATUS_LABEL[displayStatus] || "טיוטה"}
          </span>
        )}
      </header>

      {rejection && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-bold">נדחתה</p>
          <p>{rejection}</p>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#0F172A]">פרטי משלוח</h2>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#64748B]">
            פרויקט *
          </span>
          <select
            value={projectId}
            disabled={!editable}
            onChange={(e) => applyProject(e.target.value)}
            className={inputClass}
          >
            <option value="">בחר פרויקט</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#64748B]">
            יעד / מקבל
          </span>
          <input
            value={destination}
            disabled={!editable}
            onChange={(e) => {
              setDestTouched(true);
              setDestination(e.target.value);
            }}
            placeholder="שם / כתובת"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-[#64748B]">
              תאריך
            </span>
            <input
              type="date"
              value={noteDate}
              disabled={!editable}
              onChange={(e) => setNoteDate(e.target.value)}
              className={`${inputClass} px-2`}
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-[#64748B]">
              שעה
            </span>
            <input
              type="time"
              value={noteTime}
              disabled={!editable}
              onChange={(e) => setNoteTime(e.target.value)}
              className={`${inputClass} px-2`}
            />
          </label>
        </div>
      </section>

      <section className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0F172A]">פריטים</h2>
          {editable && boqItems.length > 0 && (
            <button
              type="button"
              onClick={() => setBoqOpen((v) => !v)}
              className="text-xs font-bold text-[#2563EB]"
            >
              בחר פריט מהפרויקט
            </button>
          )}
        </div>
        {boqOpen && boqItems.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[#DCE4EF] bg-white">
            {boqItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full truncate px-3 py-2 text-right text-sm hover:bg-slate-50"
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
        <div className="space-y-1.5">
          {lines.map((line, idx) => (
            <div key={idx} className="flex min-w-0 items-center gap-1.5">
              <input
                value={line.description}
                disabled={!editable}
                onChange={(e) => {
                  const v = e.target.value;
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === idx ? { ...l, description: v } : l
                    )
                  );
                }}
                placeholder="פריט / תיאור"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <QtyStepper
                value={line.quantity}
                disabled={!editable}
                onChange={(qty) => setQty(idx, qty)}
              />
              {editable && (
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
                  className="grid h-10 w-9 shrink-0 place-items-center rounded-lg text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => addLine()}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#2563EB]"
          >
            <Plus className="h-4 w-4" />
            הוסף פריט
          </button>
        )}
      </section>

      <section className="mt-4 space-y-2">
        <h2 className="text-sm font-bold text-[#0F172A]">תיעוד</h2>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#64748B]">
            הערות
          </span>
          <textarea
            value={notes}
            disabled={!editable}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[#DCE4EF] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
          />
        </label>
        {editable && (
          <>
            <select
              value={photoStage}
              onChange={(e) => setPhotoStage(e.target.value)}
              className={inputClass}
            >
              {DN_PHOTO_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[#0F172A] text-sm font-bold text-white"
              >
                <Camera className="h-4 w-4" />
                מצלמה
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-white text-sm font-bold text-[#2563EB]"
              >
                <ImageIcon className="h-4 w-4" />
                גלריה
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onPickPhoto(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPickPhoto(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </>
        )}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-[#DCE4EF] object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex overflow-hidden rounded-b-lg">
                  <button
                    type="button"
                    aria-label="צפייה"
                    onClick={() => setPreview(p)}
                    className="grid h-5 flex-1 place-items-center bg-black/55 text-white"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  {editable && (
                    <button
                      type="button"
                      aria-label="מחיקה"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="grid h-5 flex-1 place-items-center bg-red-600/90 text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editable && (
        <section className="mt-4 space-y-1.5">
          <h2 className="text-sm font-bold text-[#0F172A]">חתימה</h2>
          <SignaturePad
            value={signature}
            onChange={setSignature}
            label="חתימת מוסר / מקבל"
            placeholder="חתום כאן"
            height={96}
            showClear={false}
          />
        </section>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-[#64748B]">
          סכום / תמורה (אופציונלי)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#94A3B8]">
            ₪
          </span>
          <input
            value={price}
            disabled={!editable}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className={`${inputClass} pr-8`}
          />
        </div>
      </label>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2E8F0] bg-white/95 px-3 pt-2 backdrop-blur">
          <div
            className="mx-auto grid max-w-2xl grid-cols-2 gap-2"
            style={{
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(false)}
              className="min-h-11 rounded-lg border border-[#DCE4EF] bg-white text-sm font-bold text-[#0F172A] disabled:opacity-60"
            >
              שמור טיוטה
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="min-h-11 rounded-lg bg-[#059669] text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "שולח…" : "שלח לאישור"}
            </button>
          </div>
        </div>
      )}

      {!editable && (
        <button
          type="button"
          onClick={() => router.push("/driver/delivery-notes")}
          className="mt-4 min-h-11 w-full rounded-lg bg-[#0F172A] text-sm font-bold text-white"
        >
          חזרה לרשימה
        </button>
      )}

      {preview && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="max-h-[80dvh] max-w-full rounded-xl object-contain"
          />
        </button>
      )}
    </div>
  );
}

function QtyStepper({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (qty: number) => void;
  disabled?: boolean;
}) {
  const n = Number(value) || 0;
  return (
    <div className="flex h-10 shrink-0 items-center rounded-lg border border-[#DCE4EF] bg-white">
      <button
        type="button"
        disabled={disabled}
        aria-label="הקטן כמות"
        onClick={() => onChange(n - 1)}
        className="grid h-10 w-8 place-items-center text-[#334155] disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        disabled={disabled}
        inputMode="decimal"
        aria-label="כמות"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-8 bg-transparent text-center text-sm outline-none"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="הגדל כמות"
        onClick={() => onChange(n + 1)}
        className="grid h-10 w-8 place-items-center text-[#334155] disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
