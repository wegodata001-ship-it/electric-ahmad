"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/utils/format";
import { ActionBarContainer } from "@/components/portal";

type ShareLinkItem = {
  id: string;
  kind: "work_diary" | "delivery_note";
  documentId: string;
  documentNumber: string;
  projectId: string | null;
  publicId: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  status: "active" | "used" | "revoked" | "expired";
};

const KIND_LABELS: Record<ShareLinkItem["kind"], string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
};

const STATUS_LABELS: Record<ShareLinkItem["status"], string> = {
  active: "פעיל",
  used: "נוצל",
  revoked: "בוטל",
  expired: "פג תוקף",
};

export function ShareLinksHubPage() {
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<{ items: ShareLinkItem[] }>("/api/share-links")
      .then((data) => setItems(data.items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Share Links</h1>
        <p className="mt-1 text-sm text-gray-500">
          קישורי חתימה אחרונים ליומני עבודה ותעודות משלוח
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
            אין קישורים
          </p>
        )}
        {!loading && items.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                    {item.documentNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {KIND_LABELS[item.kind]} · {item.publicId}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    נוצר {formatRelative(item.createdAt)}
                    {item.expiresAt && ` · תוקף ${formatDate(item.expiresAt)}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "used"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
