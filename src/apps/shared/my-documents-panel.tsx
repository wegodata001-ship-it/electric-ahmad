"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";
import { apiClient } from "@/lib/api/client";

type MyDoc = {
  id: string;
  name: string;
  sourceType: string | null;
  sourceId: string | null;
  documentNumber?: string;
  project: { id: string; name: string } | null;
  url: string;
  version: number;
  status: string;
  statusLabel: string;
  updatedAt: string;
};

/** המסמכים שלי — field / driver profile tab */
export function MyDocumentsPanel({ apiPath }: { apiPath: string }) {
  const [items, setItems] = useState<MyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ items: MyDoc[] }>(apiPath)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiPath]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <FolderOpen className="h-5 w-5" />
          המסמכים שלי
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          יומנים · תעודות · PDF · סטטוס עדכני
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">טוען…</p>}
      {!loading && !items.length && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          אין מסמכים עדיין
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <FileText className="h-5 w-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-slate-900">
                  {item.documentNumber || item.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {item.sourceType === "work_diary"
                    ? "יומן עבודה"
                    : "תעודת משלוח"}
                  {item.project?.name ? ` · ${item.project.name}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  גרסה {item.version} ·{" "}
                  {new Date(item.updatedAt).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                {item.statusLabel}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={item.url}
                target="_blank"
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center text-sm font-bold text-white"
              >
                פתח PDF
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
