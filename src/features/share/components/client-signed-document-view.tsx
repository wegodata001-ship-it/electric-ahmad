"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { ClientPortalPayload } from "@/lib/share/client-portal-payload";
import { formatNumber } from "@/utils/format";

/** Official signed document — not the signing form */
export function ClientSignedDocumentView({ apiBase }: { apiBase: string }) {
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    apiClient
      .get<any>(`${apiBase}?t=${encodeURIComponent(token)}`)
      .then((d) => {
        setRaw(d);
        setPortal(d.portal ?? null);
        if (search.get("download") || search.get("autoprint")) {
          window.setTimeout(() => window.print(), 500);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, token, search]);

  const gridQty = useMemo(() => {
    if (!portal?.measurementGrid) return () => 0;
    const map = new Map(
      portal.measurementGrid.cells.map(
        (c) => [`${c.rowId}:${c.boqItemId}`, c.quantity] as const
      )
    );
    return (rowId: string, boqId: string) => map.get(`${rowId}:${boqId}`) ?? 0;
  }, [portal]);

  if (loading) {
    return (
      <p className="p-10 text-center text-slate-400" dir="rtl">
        טוען מסמך חתום…
      </p>
    );
  }
  if (error || !portal) {
    return (
      <p className="p-10 text-center text-red-600" dir="rtl">
        {error || "מסמך לא נמצא"}
      </p>
    );
  }

  const signedAt = raw?.clientSignedAt || null;
  const signerName = raw?.clientSignedName || "—";
  const signatureUrl = raw?.clientSignatureUrl || null;
  const verificationId =
    raw?.verificationId ||
    `${portal.document.number}-SIG`;

  return (
    <div className="min-h-dvh bg-slate-100 print:bg-white" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap justify-end gap-2 border-b bg-white/95 px-4 py-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" />
          הדפסה / PDF
        </button>
        <a
          href={`${apiBase.replace("/api", "")}/signed?t=${encodeURIComponent(token)}&download=1`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold"
          onClick={(e) => {
            e.preventDefault();
            window.print();
          }}
        >
          <Download className="h-4 w-4" />
          הורד PDF
        </a>
      </div>

      <article className="mx-auto my-4 max-w-3xl space-y-5 rounded-none bg-white p-6 shadow print:my-0 print:shadow-none sm:rounded-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 pb-4">
          {portal.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portal.company.logoUrl} alt="" className="h-14 object-contain" />
          ) : null}
          <div>
            <p className="text-xl font-black">{portal.company.name}</p>
            <p className="text-sm font-bold text-emerald-700">
              מסמך חתום רשמית · {portal.document.kindLabel}
            </p>
            <p className="text-sm text-slate-500">
              {portal.document.number} · {portal.document.statusLabel}
            </p>
          </div>
        </header>

        <section className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label="פרויקט" value={portal.project.name} />
          <Row label="לקוח" value={portal.project.clientName} />
          <Row label="כתובת" value={portal.project.address} />
          <Row label="חוזה" value={portal.project.contractNumber} />
          <Row label="מנהל עבודה" value={portal.project.foreman} />
          <Row label="תאריך ביצוע" value={portal.project.workDate || "—"} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-black">תוכן המסמך</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {portal.summary.whatWasDone}
          </p>
          {portal.lineItems.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {portal.lineItems.map((i) => (
                <li key={i.id} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{i.description}</span>
                  <span>
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {portal.measurementGrid && portal.measurementGrid.rooms.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-black">דף מדידה</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="border px-2 py-1 text-right">חדר</th>
                    {portal.measurementGrid.sections.map((s) => (
                      <th key={s.id} className="border px-1 py-1">
                        {s.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portal.measurementGrid.rooms.map((r) => (
                    <tr key={r.id}>
                      <td className="border px-2 py-1 font-semibold">{r.name}</td>
                      {portal.measurementGrid!.sections.map((s) => (
                        <td key={s.id} className="border px-1 py-1 text-center">
                          {formatNumber(gridQty(r.id, s.id)) || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {portal.photos.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-black">תמונות</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {portal.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.name}
                  className="h-28 w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {portal.timeline.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-black">Timeline</h2>
            <ol className="space-y-1 text-xs text-slate-600">
              {portal.timeline.map((t) => (
                <li key={t.id}>
                  • {t.label}
                  {t.at
                    ? ` — ${new Date(t.at).toLocaleString("he-IL")}`
                    : ""}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-2xl border-2 border-emerald-600/40 bg-emerald-50/50 p-4">
          <h2 className="mb-3 text-base font-black text-emerald-900">
            חתימת לקוח
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Row label="שם החותם" value={signerName} />
            <Row
              label="תאריך"
              value={
                signedAt
                  ? new Date(signedAt).toLocaleDateString("he-IL")
                  : "—"
              }
            />
            <Row
              label="שעה"
              value={
                signedAt
                  ? new Date(signedAt).toLocaleTimeString("he-IL")
                  : "—"
              }
            />
            <Row label="מזהה אימות" value={verificationId} />
          </div>
          {signatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signatureUrl}
              alt="חתימה"
              className="mt-4 h-24 max-w-full rounded-xl border border-emerald-200 bg-white object-contain"
            />
          )}
        </section>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </p>
  );
}
