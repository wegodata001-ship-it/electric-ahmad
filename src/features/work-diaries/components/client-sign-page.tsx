"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANY_PROFILE } from "@/config/company";
import { apiClient } from "@/lib/api/client";

export function ClientSignPage({
  kind,
  documentNumber,
}: {
  kind: "work-diary" | "delivery-note";
  documentNumber: string;
}) {
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const apiBase =
    kind === "work-diary"
      ? `/api/sign/work-diary/${documentNumber}`
      : `/api/sign/delivery-note/${documentNumber}`;

  useEffect(() => {
    if (!token) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    apiClient
      .get<any>(`${apiBase}?t=${encodeURIComponent(token)}`)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, token]);

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
    ctx.strokeStyle = "#03142F";
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
      setError("יש להזין שם החותם");
      return;
    }
    if (!signatureUrl) {
      setError("יש לחתום לפני השליחה");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(apiBase, {
        t: token,
        signerName: signerName.trim(),
        signatureDataUrl: signatureUrl,
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">טוען מסמך…</div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f6f8]">
        <div className="max-w-md w-full rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-3">
          {COMPANY_PROFILE.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={COMPANY_PROFILE.logoUrl} alt="" className="h-12 mx-auto object-contain" />
          ) : null}
          <h1 className="text-xl font-bold text-emerald-700">המסמך התקבל ונחתם</h1>
          <p className="text-sm text-gray-600">תודה. החתימה נשמרה במערכת.</p>
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const title = kind === "work-diary" ? "יומן עבודה" : "תעודת משלוח";

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {COMPANY_PROFILE.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={COMPANY_PROFILE.logoUrl} alt="" className="h-12 object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-md bg-[#1e40af] text-white flex items-center justify-center font-bold">
              {COMPANY_PROFILE.logoText}
            </div>
          )}
          <div>
            <p className="font-bold">{COMPANY_PROFILE.name || "WEGO ELECTRIC"}</p>
            <p className="text-xs text-gray-500">
              {COMPANY_PROFILE.address}
              {COMPANY_PROFILE.phone ? ` · ${COMPANY_PROFILE.phone}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h1 className="text-2xl font-bold text-[#03142F]">{documentNumber}</h1>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        <section className="rounded-2xl bg-white border border-gray-200 p-4 text-sm space-y-2">
          <p>
            <span className="text-gray-500">לקוח: </span>
            {doc.clientName}
          </p>
          <p>
            <span className="text-gray-500">פרויקט: </span>
            {doc.project?.name ?? "—"}
          </p>
          <p>
            <span className="text-gray-500">כתובת: </span>
            {doc.address || "—"}
          </p>
          <p>
            <span className="text-gray-500">תאריך: </span>
            {doc.workDate || doc.noteDate}
          </p>
          {doc.workSummary && <p className="whitespace-pre-wrap pt-2 border-t">{doc.workSummary}</p>}
          {doc.notes && <p className="whitespace-pre-wrap text-gray-600">{doc.notes}</p>}
        </section>

        {(doc.workItems ?? doc.items)?.length > 0 && (
          <section className="rounded-2xl bg-white border border-gray-200 p-4">
            <h2 className="font-bold mb-3">פירוט</h2>
            <ul className="text-sm space-y-2">
              {(doc.workItems ?? doc.items).map((i: any) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>{i.description}</span>
                  <span className="text-gray-500 shrink-0">
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!doc.media?.length && (
          <section className="rounded-2xl bg-white border border-gray-200 p-4">
            <h2 className="font-bold mb-3">תמונות</h2>
            <div className="grid grid-cols-2 gap-2">
              {doc.media.map((m: any) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt={m.name} className="rounded-xl object-cover h-36 w-full" />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold">חתימת לקוח</h2>
          <label className="block text-sm">
            <span className="text-gray-500">שם החותם</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="שם מלא"
            />
          </label>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">חתום באצבע או בעכבר</span>
            <button type="button" onClick={clearSignature} className="text-xs text-gray-500">
              נקה
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={700}
            height={200}
            className="w-full touch-none rounded-xl border border-dashed border-gray-300 bg-gray-50"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="w-full rounded-xl bg-[#1e40af] py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "שומר…" : "אשר וחתום"}
          </button>
        </section>
      </main>
    </div>
  );
}
