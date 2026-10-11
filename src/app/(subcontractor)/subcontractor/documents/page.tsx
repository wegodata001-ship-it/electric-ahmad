"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import {
  EmptyState,
  ErrorState,
  PortalCard,
  PortalPage,
  SkeletonGrid,
} from "@/apps/subcontractor/portal-ui";

type Doc = {
  id: string;
  title: string;
  categoryLabel: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export default function Page() {
  const [items, setItems] = useState<Doc[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    apiClient
      .get<{ items: Doc[] }>("/api/subcontractor/documents")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ items: Doc[] }>("/api/subcontractor/documents")
      .then((r) => {
        if (live) setItems(r.items);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה");
      });
    return () => {
      live = false;
    };
  }, []);

  if (error && !items) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <SkeletonGrid />;

  return (
    <PortalPage title="מסמכים" subtitle="מסמכים ששותפו איתך לפי הרשאות הפורטל">
      {items.length === 0 && <EmptyState title="אין מסמכים להצגה" />}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((d) => (
          <PortalCard key={d.id}>
            <p className="text-xs font-semibold text-[#5B6470]">{d.categoryLabel}</p>
            <p className="mt-1 font-black">{d.title}</p>
            <p className="mt-1 text-xs text-[#5B6470]">
              {d.createdAt.slice(0, 10)} · {(d.sizeBytes / 1024).toFixed(0)} KB
            </p>
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-xs font-bold text-white"
              onClick={() =>
                apiClient
                  .get<{ url: string }>(`/api/subcontractor/documents/${d.id}/url`)
                  .then((r) => window.open(r.url, "_blank"))
                  .catch((e) => setError(e.message))
              }
            >
              פתח מסמך
            </button>
          </PortalCard>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </PortalPage>
  );
}
