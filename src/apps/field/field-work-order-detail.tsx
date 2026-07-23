"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Package, Play } from "lucide-react";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";

export function FieldWorkOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    workManagementService
      .getById(orderId)
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [orderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function startWork() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const updated = await workManagementService.setStatus(
        order.id,
        "in_progress"
      );
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <p className="py-16 text-center text-white/45">{error || "טוען…"}</p>
    );
  }

  const canStart =
    order.status === "assigned" ||
    order.status === "draft" ||
    order.status === "in_progress";

  return (
    <div className="space-y-4">
      <Link
        href="/field/work-orders"
        className="inline-flex items-center gap-1 text-sm font-bold text-teal-300"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לסידורים
      </Link>

      <div>
        <p className="text-xs font-bold text-teal-300/80">
          {STATUS_LABELS[order.status]} · {order.orderNumber}
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight">
          {order.project?.name}
        </h1>
        <p className="mt-2 text-sm text-white/55">
          {order.address || order.project?.location || "—"}
        </p>
        <p className="mt-1 text-xs text-white/40">
          {new Date(order.date).toLocaleDateString("he-IL")}
          {order.title ? ` · ${order.title}` : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {order.notes && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold text-white/45">משימות / הערות</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {order.notes}
          </p>
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-bold text-white/45">עובדים</p>
        <p className="mt-2 text-sm">
          {order.workers.length
            ? order.workers.map((w) => w.name).join(" · ")
            : "לא צוינו"}
        </p>
      </section>

      {canStart && order.status !== "in_progress" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startWork()}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-black text-[#052e16] disabled:opacity-60"
        >
          <Play className="h-6 w-6" />
          {busy ? "…" : "התחל עבודה"}
        </button>
      )}

      {(order.status === "in_progress" || order.status === "completed") && (
        <div className="grid gap-3">
          <Link
            href={`/field/work-diaries/new?workOrderId=${order.id}`}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-teal-500 text-lg font-black text-[#042f2e]"
          >
            <BookOpen className="h-6 w-6" />
            יומן חדש לסידור זה
          </Link>
          <Link
            href={`/field/delivery-notes/new?workOrderId=${order.id}`}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-lg font-black"
          >
            <Package className="h-6 w-6" />
            תעודת משלוח
          </Link>
        </div>
      )}
    </div>
  );
}
