"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/utils/format";
import { useToast } from "@/components/ui";
import { ActionBarContainer } from "@/components/portal";

type ShareLinkItem = {
  id: string;
  kind: "work_diary" | "delivery_note" | "measurement_sheet" | "external";
  entityType?: string;
  title?: string | null;
  documentId: string;
  documentNumber: string;
  projectId: string | null;
  projectName?: string | null;
  publicId: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  status: "active" | "used" | "revoked" | "expired";
  viewCount?: number;
  url?: string;
  signUrl?: string | null;
  canCopy?: boolean;
  legacyToken?: boolean;
};

const KIND_LABELS: Record<string, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
  external: "שיתוף חיצוני",
};

const STATUS_LABELS: Record<ShareLinkItem["status"], string> = {
  active: "פעיל",
  used: "נחתם",
  revoked: "בוטל",
  expired: "פג תוקף",
};

export function ShareLinksHubPage({ embedded = false }: { embedded?: boolean }) {
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
    void Promise.resolve().then(reload);
  }, [reload]);

  async function revoke(id: string, kind: string) {
    try {
      await apiClient.post(
        kind === "external"
          ? `/api/external-share/${id}/revoke`
          : `/api/share-links/${kind}/${id}/revoke`,
        {}
      );
      toast.success("הקישור בוטל");
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ביטול הקישור נכשל");
    }
  }

  function resolvedUrl(item: ShareLinkItem) {
    const path = item.url || item.signUrl;
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function copyUrl(item: ShareLinkItem) {
    const full = resolvedUrl(item);
    if (!full) {
      toast.error("לא ניתן לשחזר token של קישור ישן. יש ליצור קישור חדש.");
      return;
    }
    void navigator.clipboard.writeText(full).then(
      () => toast.success("הקישור הועתק"),
      () => toast.error("העתקה נכשלה")
    );
  }

  function openUrl(item: ShareLinkItem) {
    const url = resolvedUrl(item);
    if (!url) {
      toast.error("לקישור הישן אין token שניתן לשחזר");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function createReplacement(item: ShareLinkItem) {
    try {
      const created =
        item.kind === "external"
          ? await apiClient.post<{ url: string }>("/api/external-share", {
              entityType: item.entityType,
              entityId: item.documentId,
              projectId: item.projectId,
              title: item.title || item.documentNumber,
              expiresInDays: 30,
            })
          : await apiClient.post<{ url: string }>(
              `/api/share-links/${item.kind}/${item.id}/renew`,
              {}
            );
      await navigator.clipboard.writeText(created.url);
      toast.success("נוצר קישור חדש והקישור הועתק");
      reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "יצירת הקישור נכשלה"
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {!embedded && (
          <h1 className="text-xl font-bold text-gray-900">
            קישורי שיתוף מאובטחים
          </h1>
        )}
        <p className={embedded ? "text-sm text-gray-500" : "mt-1 text-sm text-gray-500"}>
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
                    {item.projectName ? ` · ${item.projectName}` : ""}
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
                    disabled={!resolvedUrl(item)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Copy className="h-3 w-3" />
                    העתק קישור
                  </button>
                  <button
                    type="button"
                    onClick={() => openUrl(item)}
                    disabled={!resolvedUrl(item)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ExternalLink className="h-3 w-3" />
                    פתח
                  </button>
                  {item.status === "active" && (
                    <button
                      type="button"
                      onClick={() => void revoke(item.id, item.kind)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      <Ban className="h-3 w-3" />
                      בטל
                    </button>
                  )}
                  {(item.status === "expired" ||
                    item.legacyToken ||
                    !item.canCopy) && (
                    <button
                      type="button"
                      onClick={() => void createReplacement(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700"
                    >
                      <RotateCw className="h-3 w-3" />
                      צור קישור חדש
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
