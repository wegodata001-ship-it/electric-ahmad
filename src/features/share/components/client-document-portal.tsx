"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { ClientPortalPayload } from "@/lib/share/client-portal-payload";
import { formatNumber } from "@/utils/format";

type Props = {
  apiBase: string;
  /** When true, block resign if already signed */
  allowViewAfterSign?: boolean;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL");
  } catch {
    return iso;
  }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL");
  } catch {
    return iso;
  }
}

export function ClientDocumentPortal({ apiBase }: Props) {
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [saveToDocuments, setSaveToDocuments] = useState(true);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [signedViewUrl, setSignedViewUrl] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    apiClient
      .get<any>(`${apiBase}?t=${encodeURIComponent(token)}`)
      .then((d) => {
        if (d.portal) setPortal(d.portal);
        else setError("לא ניתן לטעון את פורטל המסמך");
        if (d.alreadySigned || d.portal?.alreadySigned) setDone(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, token]);

  const photos = portal?.photos ?? [];

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignatureUrl(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl(null);
  }

  async function submit() {
    setError("");
    if (!signerName.trim()) {
      setError("יש להזין שם מלא");
      return;
    }
    if (!signatureUrl) {
      setError("יש לחתום לפני האישור");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiClient.post<{
        signedViewUrl?: string;
        signedPdfUrl?: string;
        verificationId?: string;
      }>(apiBase, {
        t: token,
        signerName: signerName.trim(),
        signerRole: signerRole.trim() || undefined,
        clientNote: clientNote.trim() || undefined,
        signatureDataUrl: signatureUrl,
        saveToDocuments,
      });
      setSignedViewUrl(
        result.signedViewUrl || result.signedPdfUrl || null
      );
      setVerificationId(result.verificationId || null);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "החתימה נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  const gridQty = useMemo(() => {
    if (!portal?.measurementGrid) return () => 0;
    const map = new Map(
      portal.measurementGrid.cells.map(
        (c) => [`${c.rowId}:${c.boqItemId}`, c.quantity] as const
      )
    );
    return (rowId: string, boqId: string) =>
      map.get(`${rowId}:${boqId}`) ?? 0;
  }, [portal]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-500">
        טוען פורטל מסמך…
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-6">
        <p className="rounded-2xl bg-white px-6 py-4 text-red-600 shadow">{error}</p>
      </div>
    );
  }

  if (!portal) return null;

  if (done) {
    const openUrl =
      signedViewUrl ||
      portal.signedPdfUrl ||
      `${typeof window !== "undefined" ? window.location.pathname : ""}/signed?t=${encodeURIComponent(token)}`;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 text-center shadow-lg">
          {portal.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portal.company.logoUrl}
              alt=""
              className="mx-auto h-14 object-contain"
            />
          ) : null}
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <h1 className="text-2xl font-black text-emerald-800">
            המסמך נחתם בהצלחה
          </h1>
          <p className="text-sm text-slate-600">תודה על אישורך.</p>
          <p className="text-sm text-slate-600">החתימה נשמרה במערכת.</p>
          {verificationId && (
            <p className="text-xs text-slate-400">מזהה אימות: {verificationId}</p>
          )}
          <div className="space-y-2 pt-2">
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-base font-black text-white"
            >
              <FileText className="h-5 w-5" />
              פתח את המסמך החתום
            </a>
            <a
              href={`${openUrl}${openUrl.includes("?") ? "&" : "?"}download=1`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 px-5 font-bold text-slate-800"
            >
              <Download className="h-4 w-4" />
              הורד PDF חתום
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900" dir="rtl">
      {/* 1. Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-4">
          {portal.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portal.company.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
              LOGO
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black">{portal.company.name}</p>
            <p className="text-sm font-bold text-slate-700">
              {portal.document.kindLabel} · {portal.document.number}
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                {portal.document.statusLabel}
              </span>
              <span>תאריך: {fmtDate(portal.document.date)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 py-5 pb-28">
        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Link security meta */}
        <p className="text-center text-[11px] text-slate-400">
          קישור נוצר: {fmtDateTime(portal.linkMeta.createdAt)}
          {portal.linkMeta.expiresAt
            ? ` · תוקף: ${fmtDateTime(portal.linkMeta.expiresAt)}`
            : ""}
          {portal.linkMeta.sentBy ? ` · נשלח ע״י ${portal.linkMeta.sentBy}` : ""}
        </p>

        {/* 2. Project */}
        <Section title="פרטי הפרויקט">
          <Info label="פרויקט" value={portal.project.name} />
          <Info label="לקוח" value={portal.project.clientName} />
          <Info label="כתובת" value={portal.project.address} />
          <Info label="מספר חוזה" value={portal.project.contractNumber} />
          <Info label="מנהל פרויקט" value={portal.project.projectManager} />
          <Info label="מנהל עבודה" value={portal.project.foreman} />
          <Info label="תאריך ביצוע" value={fmtDate(portal.project.workDate)} />
        </Section>

        {/* 3. Summary */}
        <Section title="תקציר">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {portal.summary.whatWasDone}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="עובדים" value={String(portal.summary.workersCount)} />
            <Stat
              label="שעות"
              value={formatNumber(portal.summary.hoursTotal)}
            />
            <Stat label="חדרים" value={String(portal.summary.roomsCount)} />
            <Stat label="סעיפים" value={String(portal.summary.sectionsCount)} />
            <Stat label="פריטים" value={String(portal.summary.itemsCount)} />
          </div>
        </Section>

        {/* Line items */}
        {portal.lineItems.length > 0 && (
          <Section title="פירוט ביצוע">
            <ul className="space-y-2 text-sm">
              {portal.lineItems.map((i) => (
                <li
                  key={i.id}
                  className="flex justify-between gap-3 border-b border-slate-100 pb-2"
                >
                  <span>{i.description}</span>
                  <span className="shrink-0 text-slate-500">
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 5. Measurement grid */}
        {portal.measurementGrid && portal.measurementGrid.rooms.length > 0 && (
          <Section title="דפי מדידה / טבלת כמויות">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky right-0 bg-slate-50 px-2 py-2 text-right">
                      חדר
                    </th>
                    {portal.measurementGrid.sections.map((s) => (
                      <th key={s.id} className="px-2 py-2 whitespace-nowrap">
                        {s.code || s.description}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portal.measurementGrid.rooms.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="sticky right-0 bg-white px-2 py-2 font-semibold">
                        {r.name}
                      </td>
                      {portal.measurementGrid!.sections.map((s) => (
                        <td key={s.id} className="px-2 py-2 text-center">
                          {formatNumber(gridQty(r.id, s.id))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Measurement sheet list */}
        {portal.measurementSheets.length > 0 && (
          <Section title="דפי מדידה בפרויקט">
            <ul className="space-y-2">
              {portal.measurementSheets.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm"
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4 text-slate-400" />
                    {s.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {s.status}
                    {s.version ? ` · V${s.version}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 4. Related docs */}
        {portal.relatedDocuments.length > 0 && (
          <Section title="מסמכים קשורים">
            <ul className="space-y-2">
              {portal.relatedDocuments.map((d) => (
                <li key={d.id}>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold active:bg-slate-50"
                    >
                      <span>
                        📄 {d.kindLabel}: {d.title}
                      </span>
                      <Download className="h-4 w-4 text-slate-400" />
                    </a>
                  ) : (
                    <span className="block rounded-xl bg-slate-50 px-3 py-3 text-sm">
                      📄 {d.kindLabel}: {d.title}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 6. Photos */}
        {photos.length > 0 && (
          <Section title="תמונות מהשטח">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox(idx)}
                  className="overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.name}
                    className="h-36 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* 7. Attachments */}
        {portal.attachments.length > 0 && (
          <Section title="קבצים מצורפים">
            <ul className="space-y-2">
              {portal.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  >
                    <span>{a.name}</span>
                    <Download className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 8. Timeline */}
        {portal.timeline.length > 0 && (
          <Section title="היסטוריית אישורים">
            <ol className="space-y-3 border-r-2 border-slate-200 pr-4">
              {portal.timeline.map((t) => (
                <li key={t.id} className="relative text-sm">
                  <span className="absolute -right-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <p className="font-bold">{t.label}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(t.at)}</p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* 9. Notes */}
        <Section title="הערות">
          {portal.companyNotes ? (
            <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">
              {portal.companyNotes}
            </p>
          ) : (
            <p className="mb-3 text-sm text-slate-400">אין הערות מהחברה</p>
          )}
          <label className="block text-sm">
            <span className="font-semibold text-slate-600">הערת לקוח (אופציונלי)</span>
            <textarea
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="הוסיפו הערה אם יש"
            />
          </label>
        </Section>

        {/* 10. Signature — last */}
        <Section title="חתימה ואישור">
          <p className="mb-3 text-sm text-slate-500">
            לאחר שעיינתם בכל המידע — חתמו למטה
          </p>
          <label className="mb-3 block text-sm">
            <span className="font-semibold">שם מלא *</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="שם החותם"
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="font-semibold">תפקיד (אופציונלי)</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              placeholder="לדוגמה: מנהל פרויקט / מזמין"
            />
          </label>
          <label className="mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={saveToDocuments}
              onChange={(e) => setSaveToDocuments(e.target.checked)}
            />
            <span>
              <span className="font-semibold">
                לשמור את הגרסה החתומה במערכת המסמכים
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                אם מסומן — הגרסה החתומה תופיע בארכיון ובגרסאות המסמך
              </span>
            </span>
          </label>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>חתימה באצבע / עכבר</span>
            <button type="button" onClick={clearSignature} className="font-bold">
              נקה
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={700}
            height={200}
            className="mb-4 w-full touch-none rounded-2xl border border-dashed border-slate-300 bg-slate-50"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black text-white disabled:opacity-60"
          >
            {submitting ? "שומר…" : "אשר וחתום"}
          </button>
        </Section>
      </main>

      {/* Lightbox */}
      {lightbox != null && photos[lightbox] && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button type="button" onClick={() => setLightbox(null)}>
              <X className="h-6 w-6" />
            </button>
            <span className="text-sm">
              {lightbox + 1} / {photos.length}
            </span>
            <ImageIcon className="h-5 w-5 opacity-50" />
          </div>
          <div className="flex flex-1 items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightbox].url}
              alt=""
              className="max-h-[80dvh] max-w-full object-contain"
            />
          </div>
          <div className="flex justify-between px-6 pb-8">
            <button
              type="button"
              className="rounded-full bg-white/15 p-3 text-white"
              onClick={() =>
                setLightbox((i) =>
                  i == null ? 0 : (i + photos.length - 1) % photos.length
                )
              }
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <button
              type="button"
              className="rounded-full bg-white/15 p-3 text-white"
              onClick={() =>
                setLightbox((i) =>
                  i == null ? 0 : (i + 1) % photos.length
                )
              }
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-black text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3 border-b border-slate-50 py-1.5 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-left font-semibold text-slate-800">{value}</span>
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
