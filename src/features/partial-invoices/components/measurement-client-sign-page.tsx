"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANY_PROFILE } from "@/config/company";
import { apiClient } from "@/lib/api/client";
import { formatNumber } from "@/utils/format";

/** Public client page: view measurement data + sign */
export function MeasurementClientSignPage({ sheetId }: { sheetId: string }) {
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

  const apiBase = `/api/sign/measurement-sheet/${sheetId}`;

  useEffect(() => {
    if (!token) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    apiClient
      .get<any>(`${apiBase}?t=${encodeURIComponent(token)}`)
      .then((d) => {
        setDoc(d);
        if (d.alreadySigned || d.clientSignedAt) setDone(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, token]);

  const sections = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of doc?.cells ?? []) {
      if (c.boqItem) map.set(c.boqItemId, c.boqItem);
    }
    return [...map.values()].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "he")
    );
  }, [doc]);

  const rooms: any[] = doc?.rows ?? [];

  function qty(rowId: string, boqId: string) {
    const cell = (doc?.cells ?? []).find(
      (c: any) => c.rowId === rowId && c.boqItemId === boqId
    );
    return Number(cell?.quantity ?? 0);
  }

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
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        טוען מסמך…
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-6">
        <div className="w-full max-w-md space-y-3 rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-emerald-700">
            הדוח התקבל ונחתם
          </h1>
          <p className="text-sm text-gray-600">תודה. החתימה נשמרה במערכת.</p>
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900" dir="rtl">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#1e40af] font-bold text-white">
            {COMPANY_PROFILE.logoText || "W"}
          </div>
          <div>
            <p className="font-bold">{COMPANY_PROFILE.name || "WEGO ELECTRIC"}</p>
            <p className="text-xs text-gray-500">דוח ביצוע לחתימת לקוח</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div>
          <p className="text-sm text-gray-500">דף מדידה / דוח ביצוע</p>
          <h1 className="text-2xl font-bold text-[#03142F]">
            {doc?.title || doc?.documentNumber}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {doc?.project?.name || "—"}
            {doc?.documentNumber ? ` · ${doc.documentNumber}` : ""}
            {doc?.currentVersion ? ` · V${doc.currentVersion}` : ""}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-3 py-2 text-right">חדר / יחידה</th>
                {sections.map((s) => (
                  <th key={s.id} className="border-b px-2 py-2 text-center">
                    <p className="font-mono text-[10px] text-gray-400">{s.code}</p>
                    <p className="line-clamp-2 text-xs">{s.description}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-semibold">{room.name}</td>
                  {sections.map((s) => (
                    <td key={s.id} className="px-2 py-2 text-center">
                      {formatNumber(qty(room.id, s.id))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!sections.length && (
            <p className="p-6 text-center text-sm text-gray-400">
              אין נתוני מדידה להצגה
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">חתום באצבע או בעכבר</span>
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs text-gray-500"
            >
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
            onClick={() => void submit()}
            className="w-full rounded-xl bg-[#1e40af] py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "שומר…" : "אשר וחתום"}
          </button>
        </section>
      </main>
    </div>
  );
}
