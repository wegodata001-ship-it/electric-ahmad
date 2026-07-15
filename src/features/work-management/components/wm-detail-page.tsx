"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardPlus,
  Pencil,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import { workManagementService } from "../services/work-management.service";
import type { WorkOrder } from "../types";
import { WmStatusBadge } from "./wm-status-badge";
import { WmWorkflowStepper } from "./wm-workflow-stepper";
import { ExecutionReportModal } from "@/features/projects/components/execution-report-modal";
import "../styles/work-management.css";

type BoqItemForReport = {
  id: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
};

export function WmDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [boqItems, setBoqItems] = useState<BoqItemForReport[]>([]);

  const reload = useCallback(() => {
    workManagementService
      .getById(orderId)
      .then(setOrder)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function changeStatus(
    status: "in_progress" | "completed" | "cancelled"
  ) {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await workManagementService.setStatus(order.id, status);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון סטטוס");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!order) return;
    if (!window.confirm("למחוק את סידור העבודה?")) return;
    setBusy(true);
    try {
      await workManagementService.remove(order.id);
      router.push("/field/journal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקה");
      setBusy(false);
    }
  }

  async function openReport() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/boq?projectId=${order.projectId}`);
      const json = await res.json();
      const items = (json.data ?? json) as any[];
      const list = (Array.isArray(items) ? items : []).map((b) => ({
        id: b.id,
        code: b.code,
        description: b.description,
        unit: b.unit,
        contractQuantity: Number(b.contractQuantity),
        completedQuantity: Number(b.completedQuantity),
        remainingQuantity: Number(b.remainingQuantity),
      }));
      setBoqItems(list);
      setReportOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת כתב כמויות");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    if (!order) return;
    setBusy(true);
    try {
      await workManagementService.uploadMedia(order.id, file);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-16">טוען...</p>;
  }

  if (!order) {
    return (
      <div className="wm-panel text-center py-10">
        <p className="text-gray-600">סידור העבודה לא נמצא</p>
        <Link href="/field/journal" className="wm-btn wm-btn-navy mt-4 inline-flex">
          חזרה ליומן
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/field/journal"
          className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה ליומן
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#03142F]">
              {order.title || order.project?.name || order.orderNumber}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {order.orderNumber} · {order.date}
            </p>
          </div>
          <WmStatusBadge status={order.status} />
        </div>
      </div>

      <WmWorkflowStepper status={order.status} />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {order.status !== "completed" && order.status !== "cancelled" && (
          <>
            <Link
              href={`/field/journal/${order.id}/edit`}
              className="wm-btn wm-btn-secondary"
            >
              <Pencil className="h-4 w-4" />
              עריכה
            </Link>
            {order.status !== "in_progress" && (
              <button
                type="button"
                className="wm-btn wm-btn-navy"
                disabled={busy}
                onClick={() => changeStatus("in_progress")}
              >
                <Play className="h-4 w-4" />
                התחל ביצוע
              </button>
            )}
            <button
              type="button"
              className="wm-btn wm-btn-gold"
              disabled={busy}
              onClick={openReport}
            >
              <ClipboardPlus className="h-4 w-4" />
              דווח ביצוע
            </button>
            <button
              type="button"
              className="wm-btn wm-btn-gold"
              disabled={busy}
              onClick={() => changeStatus("completed")}
            >
              <CheckCircle2 className="h-4 w-4" />
              סמן כהושלם
            </button>
          </>
        )}
        {order.status !== "cancelled" && order.status !== "completed" && (
          <button
            type="button"
            className="wm-btn wm-btn-danger"
            disabled={busy}
            onClick={() => changeStatus("cancelled")}
          >
            <XCircle className="h-4 w-4" />
            בטל
          </button>
        )}
        {order.status !== "completed" && (
          <button
            type="button"
            className="wm-btn wm-btn-ghost"
            disabled={busy}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            מחק
          </button>
        )}
      </div>

      <section className="wm-panel">
        <h2 className="wm-panel-title">פרטי עבודה</h2>
        <div className="wm-form-grid">
          <div className="wm-readonly-box">
            <p className="text-xs text-gray-500">פרויקט</p>
            <p className="font-semibold">{order.project?.name}</p>
          </div>
          <div className="wm-readonly-box">
            <p className="text-xs text-gray-500">לקוח</p>
            <p className="font-semibold">{order.clientName || "—"}</p>
          </div>
          <div className="wm-readonly-box">
            <p className="text-xs text-gray-500">כתובת</p>
            <p className="font-semibold">{order.address || "—"}</p>
          </div>
          <div className="wm-readonly-box">
            <p className="text-xs text-gray-500">אזור עבודה</p>
            <p className="font-semibold">{order.workArea || "—"}</p>
          </div>
        </div>
        {order.notes && (
          <div className="wm-readonly-box mt-3">
            <p className="text-xs text-gray-500">הערות</p>
            <p className="font-medium whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </section>

      <section className="wm-panel">
        <h2 className="wm-panel-title">עובדים ({order.workers.length})</h2>
        {order.workers.length === 0 ? (
          <p className="text-sm text-gray-500">לא שובצו עובדים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="wm-line-table">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תפקיד</th>
                  <th>התחלה</th>
                  <th>סיום</th>
                  <th>שעות</th>
                </tr>
              </thead>
              <tbody>
                {order.workers.map((w) => (
                  <tr key={w.id || w.name}>
                    <td>{w.name}</td>
                    <td>{w.role || "—"}</td>
                    <td>{w.startTime || "—"}</td>
                    <td>{w.endTime || "—"}</td>
                    <td>{w.hours ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="wm-panel">
        <h2 className="wm-panel-title">רכבים ({order.vehicles.length})</h2>
        {order.vehicles.length === 0 ? (
          <p className="text-sm text-gray-500">לא שובצו רכבים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="wm-line-table">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>מספר</th>
                  <th>נהג</th>
                  <th>שעות</th>
                </tr>
              </thead>
              <tbody>
                {order.vehicles.map((v) => (
                  <tr key={v.id || v.name}>
                    <td>{v.name}</td>
                    <td>{v.plate || "—"}</td>
                    <td>{v.driverName || "—"}</td>
                    <td>{v.hours ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="wm-panel">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="wm-panel-title mb-0">תמונות ומסמכים</h2>
          <label className="wm-btn wm-btn-secondary cursor-pointer">
            <Camera className="h-4 w-4" />
            העלה
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {order.media.length === 0 ? (
          <p className="text-sm text-gray-500">אין קבצים</p>
        ) : (
          <div className="wm-file-grid">
            {order.media.map((m) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="wm-file-card"
              >
                {m.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.name} />
                ) : (
                  <div className="h-[110px] flex items-center justify-center text-sm text-gray-500">
                    מסמך
                  </div>
                )}
                <p className="text-xs mt-1 truncate">{m.name}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      <ExecutionReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        projectId={order.projectId}
        boqItems={boqItems}
        foremen={[]}
        onSuccess={() => {
          setReportOpen(false);
          if (order.status !== "completed" && order.status !== "cancelled") {
            void changeStatus("in_progress");
          }
        }}
      />
    </div>
  );
}
