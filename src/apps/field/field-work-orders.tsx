"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workManagementService } from "@/features/work-management/services/work-management.service";
import type { WorkOrder } from "@/features/work-management/types";
import { STATUS_LABELS } from "@/features/work-management/types";
import { FieldEmptyState, FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

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
    <div className="space-y-5">
      <FieldPageHeader
        title="סידורי עבודה"
        subtitle="בחר סידור והתחל עבודה"
      />

      {error && <p className={field.error}>{error}</p>}

      {loading && (
        <p className="py-12 text-center text-lg text-[#6B7280]">טוען…</p>
      )}

      {!loading && items.length === 0 && (
        <FieldEmptyState
          emoji="📋"
          title="עדיין לא התקבל סידור עבודה"
          description="כאשר מנהל התפעול ישלח סידור, הוא יופיע כאן."
        />
      )}

      <div className="space-y-4">
        {items.map((order) => (
          <Link
            key={order.id}
            href={`/field/work-orders/${order.id}`}
            className={cn(field.cardInteractive, "block")}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xl font-black leading-tight text-[#111827]">
                {order.project?.name || "פרויקט"}
              </p>
              <span className={field.badge.blue}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="mt-3 text-base text-[#6B7280]">
              {order.address || order.project?.location || "—"}
            </p>
            <p className="mt-1 text-base text-[#9CA3AF]">
              {new Date(order.date).toLocaleDateString("he-IL")}
            </p>
            {(order.status === "assigned" || order.status === "draft") && (
              <p className={cn(field.btnSuccess, "mt-5 min-h-14")}>
                התחל עבודה
              </p>
            )}
            {order.status === "in_progress" && (
              <p className={cn(field.btnPrimary, "mt-5 min-h-14")}>
                המשך עבודה
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
