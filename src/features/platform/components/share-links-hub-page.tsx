"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw, Ban, Copy } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/utils/format";
import { useToast } from "@/components/ui";
import { ActionBarContainer } from "@/components/portal";

type ShareLinkItem = {
  id: string;
  kind: "work_diary" | "delivery_note" | "measurement_sheet" | "external";
  entityType?: string;
  documentId: string;
  documentNumber: string;
  projectId: string | null;
  publicId: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  status: "active" | "used" | "revoked" | "expired";
  viewCount?: number;
  url?: string;
};

const KIND_LABELS: Record<string, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
  external: "שיתוף חיצוני",
};

const STATUS_LABELS: Record<ShareLinkItem["status"], string> = {
  active: "פעיל",
  used: "נוצל",
  revoked: "בוטל",
  expired: "פג תוקף",
};

export function ShareLinksHubPage() {
  const toast = useToast();
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<{ items: ShareLinkItem[] }>("/api/share-links"),
      apiClient
        .get<{ items: ShareLinkItem[] }>("/api/external-share")
        .catch(() => ({ items: [] as ShareLinkItem[] })),
    ])
      .then(([legacy, external]) => {
        const merged = [...(legacy.items ?? []), ...(external.items ?? [])].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setItems(merged.slice(0, 80));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function revoke(id: string, kind: string) {
    if (kind !== "external") {
      toast.error("ביטול זמין כרגע לקישורי שיתוף חיצוניים בלבד");
      return;
    }
    try {
      await apiClient.post(`/api/external-share/${id}/revoke`, {});
      toast.success("הקישור בוטל");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copyUrl(item: ShareLinkItem) {
    const path = item.url || `/share/${item.publicId}`;
    const full =
      typeof window !== "undefined"
        ? `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
        : path;
    void navigator.clipboard.writeText(full).then(
      () => toast.success("הקישור הועתק"),
      () => toast.error("העתקה נכשלה")
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">קישורי שיתוף מאובטחים</h1>
        <p className="mt-1 text-sm text-gray-500">
          שיתוף מסמכים עם לקוח / מפקח / יועץ — ללא Login. יצירה ממסך המסמך.
        </p>
      </div>

      <ActionBarContainer
        actions={[
          {
            id: "refresh",
            label: "רענון",
            icon: RefreshCw,
            onClick: reload,
          },
        ]}
      />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">טוען...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            אין קישורים — צרו קישור ממסך המסמכים
          </p>
        )}
        {!loading && items.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                    {item.documentNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {KIND_LABELS[item.kind] || item.kind}
                    {item.entityType ? ` · ${item.entityType}` : ""}
                    {" · "}
                    {STATUS_LABELS[item.status]}
                    {item.viewCount != null ? ` · ${item.viewCount} צפיות` : ""}
                    {" · "}
                    {formatRelative(item.createdAt)}
                  </p>
                  {item.expiresAt && (
                    <p className="text-[11px] text-gray-400">
                      תוקף: {formatDate(item.expiresAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyUrl(item)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"
                  >
                    <Copy className="h-3 w-3" />
                    העתק
                  </button>
                  {item.kind === "external" && item.status === "active" && (
                    <button
                      type="button"
                      onClick={() => void revoke(item.id, item.kind)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      <Ban className="h-3 w-3" />
                      בטל
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
