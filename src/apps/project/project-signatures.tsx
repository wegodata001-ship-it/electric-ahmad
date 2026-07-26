"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatRelative } from "@/utils/format";

type ShareLinkItem = {
  id: string;
  kind: "work_diary" | "delivery_note" | string;
  documentNumber: string;
  status: "active" | "used" | "revoked" | "expired";
  createdAt: string;
  usedAt: string | null;
  expiresAt: string | null;
};

const KIND: Record<string, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "ממתין לחתימה", cls: "bg-amber-100 text-amber-900" },
  used: { label: "נחתם", cls: "bg-emerald-100 text-emerald-900" },
  revoked: { label: "בוטל", cls: "bg-slate-100 text-slate-600" },
  expired: { label: "פג תוקף", cls: "bg-red-100 text-red-800" },
};

/** Simple signatures tracker for Project Manager (mobile) */
export function ProjectSignatures() {
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ items: ShareLinkItem[] }>("/api/share-links")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">חתימות</h1>
          <p className="mt-1 text-sm text-slate-500">
            מי קיבל קישור · מי חתם · מי עדיין לא
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="rounded-xl border border-blue-200 bg-white p-2.5"
        >
          <RefreshCw className="h-5 w-5 text-blue-700" />
        </button>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="py-10 text-center text-slate-400">טוען…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-blue-200 bg-white py-12 text-center">
          <Link2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">אין קישורי חתימה עדיין</p>
          <a
            href="/project/share-links"
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-blue-700 px-5 text-sm font-black text-white"
          >
            מעבר ל־Share Links
          </a>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const st = STATUS[item.status] || STATUS.active;
          return (
            <article
              key={item.id}
              className="rounded-3xl border border-blue-100 bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-400">
                    {KIND[item.kind] || item.kind}
                  </p>
                  <p className="mt-1 font-black">{item.documentNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    נוצר {formatRelative(item.createdAt)}
                    {item.usedAt
                      ? ` · נחתם ${formatRelative(item.usedAt)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}
                >
                  {st.label}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
