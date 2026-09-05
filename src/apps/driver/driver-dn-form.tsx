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
      .get<any>(`/api/driver/delivery-notes/${editId}`)
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
        setStatus(n.status);
        setRejection(n.rejectionComment || null);
        setDocNumber(n.documentNumber || null);
        if (n.price || n.transportCost || n.financialNotes) setShowPricing(true);
        const items = (n.items || []).map((it: any) => ({
          description: it.description || "",
          quantity: String(it.quantity ?? 1),
          unit: it.unit || "יח'",
        }));
        setLines(
          items.length ? items : [{ description: "", quantity: "1", unit: "יח'" }]
        );
        if (Array.isArray(n.media)) {
          setPhotos(n.media.map((m: any) => m.url).filter(Boolean));
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

      let note: any;
      if (editId) {
        note = await apiClient.patch(
          `/api/driver/delivery-notes/${editId}`,
          payload
        );
      } else {
        note = await apiClient.post("/api/driver/delivery-notes", payload);
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
    } catch (e: any) {
      setError(e.message || "שמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const editable = !status || status === "draft" || status === "revision";

  return (
    <div className="space-y-4">
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

      <label className="block space-y-1.5">
        <span className="text-sm font-bold text-slate-700">פרויקט</span>
        <select
          value={projectId}
          disabled={!editable}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base"
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
          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">תאריך</span>
          <input
            type="date"
            value={noteDate}
            disabled={!editable}
            onChange={(e) => setNoteDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3.5 text-base"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">שעה</span>
          <input
            type="time"
            value={noteTime}
            disabled={!editable}
            onChange={(e) => setNoteTime(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3.5 text-base"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-700">פריטים שנמסרו</p>
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
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-3 text-base"
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
              className="w-20 rounded-2xl border border-slate-200 px-2 py-3 text-center text-base"
            />
          </div>
        ))}
        {editable && (
          <button
            type="button"
            onClick={addLine}
            className="text-sm font-bold text-slate-700 underline"
          >
            + הוסף פריט
          </button>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold text-slate-700">הערות</span>
        <textarea
          value={notes}
          disabled={!editable}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
        />
      </label>

      {editable && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700">תמונות</p>
          <select
            value={photoStage}
            onChange={(e) => setPhotoStage(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
          >
            {DN_PHOTO_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 text-white"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs font-black">מצלמה</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 bg-white"
            >
              <ImageIcon className="h-5 w-5" />
              <span className="text-xs font-black">גלריה</span>
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
                  className="h-16 w-16 rounded-xl object-cover"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editable && (
        <div className="rounded-3xl border border-slate-200 bg-white p-3">
          <SignaturePad
            value={signature}
            onChange={setSignature}
            label="חתימת יוצר המסמך (חובה לפני שליחה)"
            height={140}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPricing((v) => !v)}
        className="text-sm font-bold text-slate-600 underline"
      >
        {showPricing ? "הסתר תמחור" : "תמחור (אופציונלי)"}
      </button>

      {showPricing && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
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
            className="min-h-[3.5rem] rounded-3xl bg-emerald-600 text-lg font-black text-white disabled:opacity-60"
          >
            {busy ? "שולח…" : "שלח לאישור"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="min-h-[3.25rem] rounded-3xl border-2 border-slate-200 bg-white text-base font-bold text-slate-800 disabled:opacity-60"
          >
            שמור טיוטה
          </button>
        </div>
      )}

      {!editable && (
        <button
          type="button"
          onClick={() => router.push("/driver/delivery-notes")}
          className="w-full min-h-[3.25rem] rounded-3xl bg-slate-900 text-base font-bold text-white"
        >
          חזרה לרשימה
        </button>
      )}
    </div>
  );
}
