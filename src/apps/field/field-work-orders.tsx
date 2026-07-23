"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";

export function FieldWorkOrders() {
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    workManagementService
      .list()
      .then((data) => setItems(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">סידורי עבודה</h1>
        <p className="mt-1 text-sm text-white/45">בחר סידור והתחל עבודה</p>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading && <p className="py-12 text-center text-white/40">טוען…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/15 px-4 py-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-white/25" />
          <p className="mt-3 font-bold text-white/60">אין סידורים כרגע</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((order) => (
          <Link
            key={order.id}
            href={`/field/work-orders/${order.id}`}
            className="block rounded-3xl border border-white/10 bg-white/5 p-4 active:bg-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-black leading-tight">
                {order.project?.name || "פרויקט"}
              </p>
              <span className="shrink-0 rounded-full bg-teal-500/20 px-2.5 py-1 text-[11px] font-bold text-teal-200">
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/55">
              {order.address || order.project?.location || "—"}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {new Date(order.date).toLocaleDateString("he-IL")}
              {order.title ? ` · ${order.title}` : ""}
            </p>
            <p className="mt-3 text-xs text-white/50">
              עובדים:{" "}
              {order.workers.length
                ? order.workers.map((w) => w.name).join(", ")
                : "לא צוינו"}
            </p>
            {(order.status === "assigned" || order.status === "draft") && (
              <p className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-emerald-500 text-base font-black text-[#052e16]">
                התחל עבודה
              </p>
            )}
            {order.status === "in_progress" && (
              <p className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-teal-500/30 text-base font-black text-teal-100">
                המשך עבודה
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
