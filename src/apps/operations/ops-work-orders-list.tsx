"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";

type Item = {
  id: string;
  orderNumber: string;
  date: string;
  title: string | null;
  status: string;
  address: string | null;
  project?: { name: string; location?: string } | null;
  foreman?: { name: string } | null;
  workers?: { name: string }[];
};

const STATUS: Record<string, string> = {
  draft: "טיוטה",
  assigned: "נשלח",
  in_progress: "בביצוע",
  completed: "הסתיים",
  cancelled: "בוטל",
};

export function OpsWorkOrdersList() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ items: Item[] }>("/api/work-orders")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">סידורי עבודה</h2>
          <p className="mt-1 text-sm text-stone-500">מה שנשלח לשטח</p>
        </div>
        <Link
          href="/operations/work-orders/new"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-amber-700 px-4 font-black text-white"
        >
          <Plus className="h-5 w-5" />
          חדש
        </Link>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-white py-12 text-center text-stone-400">
          אין סידורים — צור את הראשון
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl bg-white px-4 py-4 ring-1 ring-amber-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-stone-900">
                  {item.project?.name || "פרויקט"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {item.orderNumber} ·{" "}
                  {new Date(item.date).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                {STATUS[item.status] || item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {item.address || item.project?.location || item.title || "—"}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              מנהל עבודה: {item.foreman?.name || "—"}
              {item.workers?.length
                ? ` · ${item.workers.length} עובדים`
                : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
