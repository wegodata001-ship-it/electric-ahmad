"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { SignaturePad } from "@/features/delivery-notes/components/signature-pad";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import {
  DRIVER_DN_STATUS_LABEL,
  driverDnStatusTone,
} from "@/apps/driver/driver-dn-status";
import { DN_PHOTO_STAGES } from "@/apps/shared/field-media-capture";

type Project = { id: string; name: string; location?: string };
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

export function DriverDnForm({ editId }: Props) {
  const router = useRouter();
  const { userName } = usePortalSession("driver");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [destination, setDestination] = useState("");
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
  const [status, setStatus] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

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
        if (n.price || n.transportCost || n.financialNotes) setShowPricing(true);
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

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unit: "יח'" }]);
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
      }

      router.replace(`/driver/delivery-notes/${id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const editable = !status || status === "draft" || status === "revision";

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-black">
          {editId ? "עריכת תעודה" : "תעודת משלוח חדשה"}
        </h1>
        {docNumber && (
          <p className="mt-1 text-sm text-slate-500">{docNumber}</p>
        )}
        {status && (
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${driverDnStatusTone(status)}`}
          >
            {DRIVER_DN_STATUS_LABEL[status] || status}
          </span>
        )}
      </div>

      {rejection && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">נדחתה</p>
          <p className="mt-1">{rejection}</p>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="border-b border-slate-100 pb-3 font-black text-slate-900">
          פרטי משלוח
        </h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">פרויקט</span>
          <select
            value={projectId}
            disabled={!editable}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
          >
            <option value="">בחר פרויקט…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">יעד</span>
          <input
            value={destination}
            disabled={!editable}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="כתובת / שם מקבל"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-bold text-slate-700">תאריך</span>
            <input
              type="date"
              value={noteDate}
              disabled={!editable}
              onChange={(e) => setNoteDate(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 px-2 py-3 text-sm"
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-bold text-slate-700">שעה</span>
            <input
              type="time"
              value={noteTime}
              disabled={!editable}
              onChange={(e) => setNoteTime(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 px-2 py-3 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="border-b border-slate-100 pb-3 font-black text-slate-900">
          פריטים
        </h2>
        {lines.map((line, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={line.description}
              disabled={!editable}
              onChange={(e) => {
                const v = e.target.value;
                setLines((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, description: v } : l))
                );
              }}
              placeholder="פריט"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-base"
            />
            <input
              value={line.quantity}
              disabled={!editable}
              onChange={(e) => {
                const v = e.target.value;
                setLines((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l))
                );
              }}
              inputMode="decimal"
              className="w-16 shrink-0 rounded-xl border border-slate-200 px-2 py-3 text-center text-base"
            />
          </div>
        ))}
        {editable && (
          <button
            type="button"
            onClick={addLine}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
          >
            + הוסף פריט
          </button>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="border-b border-slate-100 pb-3 font-black text-slate-900">
          תיעוד
        </h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">הערות</span>
          <textarea
            value={notes}
            disabled={!editable}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
          />
        </label>

        {editable && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">תמונות</p>
          <select
            value={photoStage}
            onChange={(e) => setPhotoStage(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
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
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-white"
            >
              <Camera className="h-4 w-4" />
              <span className="text-xs font-bold">מצלמה</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs font-bold">גלריה</span>
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0] || null)}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0] || null)}
          />
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              ))}
            </div>
          )}
          </div>
        )}
      </section>

      {editable && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-black text-slate-900">חתימת נהג</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            חובה לפני שליחת המסמך
          </p>
          <SignaturePad
            value={signature}
            onChange={setSignature}
            label="אזור חתימה"
            height={110}
          />
        </section>
      )}

      <button
        type="button"
        onClick={() => setShowPricing((v) => !v)}
        className="text-sm font-bold text-slate-600 underline"
      >
        {showPricing ? "הסתר תמחור" : "תמחור (אופציונלי)"}
      </button>

      {showPricing && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">מחיר</span>
            <input
              value={price}
              disabled={!editable}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">עלות הובלה</span>
            <input
              value={transportCost}
              disabled={!editable}
              onChange={(e) => setTransportCost(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">הערות כספיות</span>
            <input
              value={financialNotes}
              disabled={!editable}
              onChange={(e) => setFinancialNotes(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {editable && (
        <div className="grid gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="min-h-14 rounded-2xl bg-slate-900 text-base font-black text-white disabled:opacity-60"
          >
            {busy ? "שולח…" : "שלח לאישור"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="min-h-14 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-800 disabled:opacity-60"
          >
            שמור טיוטה
          </button>
        </div>
      )}

      {!editable && (
        <button
          type="button"
          onClick={() => router.push("/driver/delivery-notes")}
          className="min-h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white"
        >
          חזרה לרשימה
        </button>
      )}
    </div>
  );
}
