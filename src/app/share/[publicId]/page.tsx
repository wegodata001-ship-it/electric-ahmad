"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import type { ClientPortalPayload } from "@/lib/share/client-portal-payload";

type ShareView = {
  title: string;
  notes: string | null;
  projectName: string | null;
  entityType: string;
  document: { name: string; url: string | null; type?: string } | null;
  portal: ClientPortalPayload | null;
  expiresAt: string | null;
};

export default function PublicSharePage() {
  const params = useParams();
  const search = useSearchParams();
  const publicId = String(params.publicId ?? "");
  const t = search.get("t");
  const [data, setData] = useState<ShareView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) return;
    const qs = t ? `?t=${encodeURIComponent(t)}` : "";
    fetch(`/api/external-share/public/${publicId}${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || j?.message || "שגיאה");
        setData(j.data ?? j);
      })
      .catch((e) => setError(e.message));
  }, [publicId, t]);

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10"
      dir="rtl"
    >
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          שיתוף מאובטח
        </p>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {!error && !data && (
          <p className="mt-6 text-sm text-slate-400">טוען…</p>
        )}
        {data && (
          <div className="mt-4 space-y-4">
            <h1 className="text-2xl font-black text-slate-900">{data.title}</h1>
            {data.projectName && (
              <p className="text-sm text-slate-600">
                פרויקט: <span className="font-semibold">{data.projectName}</span>
              </p>
            )}
            {data.notes && (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {data.notes}
              </p>
            )}
            {data.portal && (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="text-xs font-bold text-blue-700">
                    {data.portal.document.kindLabel}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">
                    {data.portal.document.number}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {data.portal.document.statusLabel}
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <InfoRow label="פרויקט" value={data.portal.project.name} />
                  <InfoRow label="לקוח" value={data.portal.project.clientName} />
                  <InfoRow
                    label="תאריך"
                    value={data.portal.document.date || "—"}
                  />
                  <InfoRow
                    label="מנהל עבודה"
                    value={data.portal.project.foreman}
                  />
                </div>
                {data.portal.summary.whatWasDone && (
                  <section>
                    <h3 className="text-sm font-black">תוכן המסמך</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {data.portal.summary.whatWasDone}
                    </p>
                  </section>
                )}
                {data.portal.lineItems.length > 0 && (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {data.portal.lineItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 py-2"
                      >
                        <span>{item.description}</span>
                        <span className="shrink-0 font-semibold">
                          {item.quantity} {item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!data.portal && data.document?.url ? (
              <a
                href={data.document.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                <ExternalLink className="h-4 w-4" />
                פתח מסמך
              </a>
            ) : (
              !data.portal && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-500">
                  <FileText className="h-4 w-4" />
                  אין קובץ מצורף לצפייה
                </div>
              )
            )}
            {data.expiresAt && (
              <p className="text-[11px] text-slate-400">
                תוקף עד {new Date(data.expiresAt).toLocaleDateString("he-IL")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <strong>{value || "—"}</strong>
    </p>
  );
}
