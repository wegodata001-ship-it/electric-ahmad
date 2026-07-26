"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Package, Play, Save } from "lucide-react";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

export function FieldWorkOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [workersText, setWorkersText] = useState("");
  const [hoursText, setHoursText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const reload = useCallback(() => {
    workManagementService
      .getById(orderId)
      .then((o) => {
        setOrder(o);
        setNotes(o.notes || "");
        setWorkersText(
          o.workers
            .map((w) => (w.hours ? `${w.name}|${w.hours}` : w.name))
            .join("\n")
        );
      })
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

  async function saveProgress() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const defaultHours = Number(hoursText) || 0;
      const workers = workersText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, hrs] = line.split("|").map((s) => s.trim());
          return {
            name: name || line,
            hours: Number(hrs) || defaultHours,
          };
        });

      const updated = await workManagementService.update(order.id, {
        notes: notes.trim() || undefined,
        workers,
      });

      for (const file of photos.slice(0, 8)) {
        try {
          await workManagementService.uploadMedia(order.id, file);
        } catch {
          /* optional */
        }
      }
      setPhotos([]);
      setOrder(updated);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <p className="py-16 text-center text-lg text-[#6B7280]">
        {error || "טוען…"}
      </p>
    );
  }

  const canStart =
    order.status === "assigned" ||
    order.status === "draft" ||
    order.status === "in_progress";

  const canCreateDocs = order.status !== "cancelled";

  return (
    <div className="space-y-5">
      <Link
        href="/field/work-orders"
        className="inline-flex items-center gap-1 text-base font-bold text-blue-600"
      >
        <ArrowRight className="h-5 w-5" />
        חזרה לסידורים
      </Link>

      <div>
        <p className="text-base font-bold text-blue-600">
          {STATUS_LABELS[order.status]} · {order.orderNumber}
        </p>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-[#111827]">
          {order.project?.name}
        </h1>
        <p className="mt-3 text-lg text-[#6B7280]">
          {order.address || order.project?.location || "—"}
        </p>
        <p className="mt-1 text-base text-[#9CA3AF]">
          {new Date(order.date).toLocaleDateString("he-IL")}
          {order.title ? ` · ${order.title}` : ""}
        </p>
      </div>

      {error && <p className={field.error}>{error}</p>}

      <section className={field.card}>
        <p className="text-base font-bold text-[#6B7280]">משימות / הערות</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={cn(field.input, "mt-3")}
          placeholder="עדכון התקדמות / הערות מהשטח"
        />
      </section>

      <section className={field.card}>
        <p className="text-base font-bold text-[#6B7280]">
          עובדים (שורה: שם או שם|שעות)
        </p>
        <textarea
          value={workersText}
          onChange={(e) => setWorkersText(e.target.value)}
          rows={3}
          className={cn(field.input, "mt-3")}
        />
        <label className="mt-3 block space-y-2">
          <span className="text-base font-bold text-[#6B7280]">
            שעות ברירת מחדל
          </span>
          <input
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
            inputMode="decimal"
            placeholder="8"
            className={field.input}
          />
        </label>
      </section>

      <section className={field.card}>
        <p className="text-base font-bold text-[#6B7280]">תמונות</p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) =>
            setPhotos(Array.from(e.target.files || []).slice(0, 8))
          }
          className="mt-3 block w-full text-base text-[#6B7280] file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-bold file:text-white"
        />
        {photos.length > 0 && (
          <p className="mt-2 text-base text-[#6B7280]">
            {photos.length} תמונות לשמירה
          </p>
        )}
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={() => void saveProgress()}
        className={cn(field.btnPrimary, "min-h-16 gap-2 text-xl")}
      >
        <Save className="h-6 w-6" />
        {busy ? "…" : "שמור התקדמות"}
      </button>

      {canStart && order.status !== "in_progress" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startWork()}
          className={cn(field.btnSuccess, "min-h-16 gap-2 text-xl")}
        >
          <Play className="h-6 w-6" />
          {busy ? "…" : "התחל עבודה"}
        </button>
      )}

      {canCreateDocs && (
        <div className="grid gap-4">
          <Link
            href={`/field/work-diaries/new?workOrderId=${order.id}`}
            className={cn(field.btnPrimary, "min-h-16 gap-2 text-lg")}
          >
            <BookOpen className="h-6 w-6" />
            יומן חדש לסידור זה
          </Link>
          <Link
            href={`/field/delivery-notes/new?workOrderId=${order.id}`}
            className={cn(field.btnGhost, "min-h-16 gap-2 text-lg")}
          >
            <Package className="h-6 w-6" />
            תעודת משלוח
          </Link>
        </div>
      )}
    </div>
  );
}
