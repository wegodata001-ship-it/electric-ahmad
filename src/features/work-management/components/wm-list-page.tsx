"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { workManagementService } from "../services/work-management.service";
import type { WorkOrder, WorkOrderCounts, WorkOrderStatus } from "../types";
import { STATUS_LABELS } from "../types";
import { WmStatusBadge } from "./wm-status-badge";
import "../styles/work-management.css";

const TABS: { key: WorkOrderStatus | "all"; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "draft", label: STATUS_LABELS.draft },
  { key: "assigned", label: STATUS_LABELS.assigned },
  { key: "in_progress", label: STATUS_LABELS.in_progress },
  { key: "completed", label: STATUS_LABELS.completed },
];

export function WmListPage() {
  const [tab, setTab] = useState<WorkOrderStatus | "all">("all");
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [counts, setCounts] = useState<WorkOrderCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    workManagementService
      .list(tab === "all" ? undefined : tab)
      .then((data) => {
        setItems(data.items);
        setCounts(data.counts);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#03142F]">יומן עבודה</h1>
          <p className="text-sm text-gray-500 mt-1">
            סידורי עבודה, עובדים ודיווחי ביצוע
          </p>
        </div>
        <Link href="/field/journal/new" className="wm-btn wm-btn-gold">
          <Plus className="h-4 w-4" />
          סידור חדש
        </Link>
      </div>

      {counts && (
        <div className="wm-kpi-grid">
          <div className="wm-kpi">
            <strong>{counts.todayCount}</strong>
            <span>היום</span>
          </div>
          <div className="wm-kpi">
            <strong>{counts.draft}</strong>
            <span>טיוטות</span>
          </div>
          <div className="wm-kpi">
            <strong>{counts.inProgress}</strong>
            <span>בביצוע</span>
          </div>
          <div className="wm-kpi">
            <strong>{counts.completed}</strong>
            <span>הושלמו</span>
          </div>
        </div>
      )}

      <div className="wm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`wm-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">טוען...</p>
      ) : items.length === 0 ? (
        <div className="wm-panel text-center py-10">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">אין סידורי עבודה</p>
          <Link
            href="/field/journal/new"
            className="wm-btn wm-btn-navy mt-4 inline-flex"
          >
            צור סידור ראשון
          </Link>
        </div>
      ) : (
        <div className="wm-card-list">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/field/journal/${order.id}`}
              className="wm-order-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#03142F]">
                    {order.title || order.project?.name || order.orderNumber}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {order.orderNumber} · {order.date}
                    {order.workArea ? ` · ${order.workArea}` : ""}
                  </p>
                </div>
                <WmStatusBadge status={order.status} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {order.workerCount} עובדים · {order.vehicleCount} רכבים
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
