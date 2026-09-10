"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  Camera,
  Check,
  Clock,
  FileText,
  ImageIcon,
  Package,
  PenLine,
  Plus,
  Send,
  Trash2,
  Truck,
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

const inputClass =
  "w-full min-h-[52px] rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] px-4 text-base text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] disabled:opacity-60";

const labelClass = "block text-sm font-semibold text-[#334155]";

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
  const [draftSavedHint, setDraftSavedHint] = useState(false);

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
  const selectedProject = projects.find((p) => p.id === projectId);
  const displayStatus = status || (draftSavedHint ? "draft" : "draft");
  const statusDotClass =
    displayStatus === "pending_approval" || displayStatus === "sent_to_client"
      ? "bg-[#EA580C]"
      : displayStatus === "approved" ||
          displayStatus === "signed" ||
          displayStatus === "closed"
        ? "bg-[#059669]"
        : displayStatus === "revision"
          ? "bg-red-500"
          : "bg-[#94A3B8]";

  return (
    <div className="space-y-4 overflow-x-hidden pb-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF7ED] text-[#EA580C]">
          {editId ? <FileText className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-[#0F172A]">
            {editId ? "עריכת תעודה" : "תעודת משלוח חדשה"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            יצירת תעודת משלוח חדשה לפרויקט
          </p>
          {docNumber && (
            <p className="mt-1 text-sm font-semibold text-[#64748B]">
              {docNumber}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
              תעודת משלוח
              <span
                className={`h-2 w-2 rounded-full ${statusDotClass}`}
                aria-hidden
              />
              {draftSavedHint && !status
                ? "נשמרה טיוטה"
                : DRIVER_DN_STATUS_LABEL[displayStatus] || "טיוטה"}
            </span>
            {status && (
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${driverDnStatusTone(status)}`}
              >
                {DRIVER_DN_STATUS_LABEL[status] || status}
              </span>
            )}
          </div>
        </div>
      </div>

      {rejection && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">נדחתה</p>
          <p className="mt-1">{rejection}</p>
        </div>
      )}

      <SectionCard
        title="פרטי משלוח"
        accent="blue"
        icon={<Truck className="h-4 w-4" />}
      >
        <label className="block space-y-1.5">
          <span className={labelClass}>פרויקט</span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#2563EB]">
              <Building2 className="h-4 w-4" />
            </span>
            <select
              value={projectId}
              disabled={!editable}
              onChange={(e) => setProjectId(e.target.value)}
              className={`${inputClass} border-[#BFDBFE] bg-[#EFF6FF] pr-10`}
            >
              <option value="">בחר פרויקט…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {selectedProject && (
            <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB]">
              פרויקט נבחר
              <span className="truncate font-semibold text-[#0F172A]">
                {selectedProject.name}
              </span>
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>יעד</span>
          <input
            value={destination}
            disabled={!editable}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="כתובת / שם מקבל"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0 space-y-1.5">
            <span className={`${labelClass} inline-flex items-center gap-1.5`}>
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              תאריך
            </span>
            <input
              type="date"
              value={noteDate}
              disabled={!editable}
              onChange={(e) => setNoteDate(e.target.value)}
              className={`${inputClass} px-2 text-sm`}
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className={`${labelClass} inline-flex items-center gap-1.5`}>
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F5F3FF] text-[#7C3AED]">
                <Clock className="h-3.5 w-3.5" />
              </span>
              שעה
            </span>
            <input
              type="time"
              value={noteTime}
              disabled={!editable}
              onChange={(e) => setNoteTime(e.target.value)}
              className={`${inputClass} px-2 text-sm`}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="פריטים"
        accent="purple"
        icon={<Package className="h-4 w-4" />}
      >
        <div className="space-y-0 divide-y divide-[#E8EEF6]">
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2 py-3 first:pt-0 last:pb-0">
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
                placeholder="שם הפריט"
                className={`${inputClass} min-w-0 flex-1 px-3`}
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
                aria-label="כמות"
                className={`${inputClass} w-16 shrink-0 px-2 text-center`}
              />
            </div>
          ))}
        </div>
        {editable && (
          <button
            type="button"
            onClick={addLine}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-3 text-sm font-bold text-[#2563EB]"
          >
            <Plus className="h-4 w-4" />
            הוסף פריט
          </button>
        )}
      </SectionCard>

      <SectionCard
        title="תיעוד"
        accent="orange"
        icon={<Camera className="h-4 w-4" />}
      >
        <label className="block space-y-1.5">
          <span className={labelClass}>הערות</span>
          <textarea
            value={notes}
            disabled={!editable}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] px-4 py-3 text-base text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] disabled:opacity-60"
          />
        </label>

        {editable && (
          <div className="space-y-3">
            <p className={labelClass}>תמונות</p>
            <select
              value={photoStage}
              onChange={(e) => setPhotoStage(e.target.value)}
              className={`${inputClass} min-h-[44px] py-2.5 text-sm`}
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
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-3 text-white"
              >
                <Camera className="h-4 w-4" />
                <span className="text-xs font-bold">מצלמה</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2563EB] bg-white px-3 text-[#2563EB]"
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
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p}
                      alt=""
                      className="h-14 w-14 rounded-lg border border-[#DCE4EF] object-cover"
                    />
                    <button
                      type="button"
                      aria-label="מחק תמונה"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-[#DCE4EF]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {editable && (
        <SectionCard
          title="חתימת יוצר המסמך"
          accent="green"
          icon={<PenLine className="h-4 w-4" />}
        >
          <p className="mb-2 text-xs text-[#64748B]">חובה לפני שליחת המסמך</p>
          {signature && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold text-[#059669]">
              <Check className="h-3.5 w-3.5" />
              חתימה נקלטה
            </span>
          )}
          <div className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
            <SignaturePad
              value={signature}
              onChange={setSignature}
              label="אזור חתימה"
              height={110}
            />
          </div>
        </SectionCard>
      )}

      <button
        type="button"
        onClick={() => setShowPricing((v) => !v)}
        className="text-sm font-bold text-[#64748B] underline"
      >
        {showPricing ? "הסתר תמחור" : "תמחור (אופציונלי)"}
      </button>

      {showPricing && (
        <div className="space-y-3 rounded-2xl border border-[#DCE4EF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#64748B]">מחיר</span>
            <input
              value={price}
              disabled={!editable}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#64748B]">
              עלות הובלה
            </span>
            <input
              value={transportCost}
              disabled={!editable}
              onChange={(e) => setTransportCost(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#64748B]">
              הערות כספיות
            </span>
            <input
              value={financialNotes}
              disabled={!editable}
              onChange={(e) => setFinancialNotes(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {editable && (
        <div className="grid gap-3 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[14px] bg-[#059669] text-base font-bold text-white transition active:bg-[#047857] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {busy ? "שולח…" : "שלח לאישור"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="min-h-[52px] rounded-[14px] border border-[#DCE4EF] bg-white text-base font-bold text-[#0F172A] disabled:opacity-60"
          >
            שמור טיוטה
          </button>
        </div>
      )}

      {!editable && (
        <button
          type="button"
          onClick={() => router.push("/driver/delivery-notes")}
          className="min-h-[58px] w-full rounded-[14px] bg-[#0F172A] text-base font-bold text-white"
        >
          חזרה לרשימה
        </button>
      )}
    </div>
  );
}

function SectionCard({
  title,
  accent,
  icon,
  children,
}: {
  title: string;
  accent: "blue" | "purple" | "orange" | "green";
  icon: ReactNode;
  children: ReactNode;
}) {
  const accents = {
    blue: {
      bar: "bg-[#2563EB]",
      iconBg: "bg-[#EFF6FF] text-[#2563EB]",
    },
    purple: {
      bar: "bg-[#7C3AED]",
      iconBg: "bg-[#F5F3FF] text-[#7C3AED]",
    },
    orange: {
      bar: "bg-[#EA580C]",
      iconBg: "bg-[#FFF7ED] text-[#EA580C]",
    },
    green: {
      bar: "bg-[#059669]",
      iconBg: "bg-[#ECFDF5] text-[#059669]",
    },
  }[accent];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#DCE4EF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:p-5">
      <span
        className={`absolute inset-x-0 top-0 h-0.5 ${accents.bar}`}
        aria-hidden
      />
      <h2 className="mb-4 flex items-center gap-2 border-b border-[#E8EEF6] pb-3 font-black text-[#0F172A]">
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${accents.iconBg}`}
        >
          {icon}
        </span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
