"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Printer, QrCode, RefreshCw, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button, useToast } from "@/components/ui";
import { formatDate } from "@/utils/format";

type EmployeeRow = {
  userId: string;
  userName: string;
  role: string;
  roleLabel: string;
  email: string;
  registered: boolean;
  statusLabel: string;
  enrolledAt: string | null;
  deviceRowId: string | null;
  deviceId: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  lastSeenAt: string | null;
  lastCheckInAt: string | null;
  lastCheckOutAt: string | null;
  approved: boolean;
};

type LogRow = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  ipAddress: string | null;
  deviceId: string | null;
  deviceType: string | null;
  osName: string | null;
  userAgent: string | null;
};

type Config = {
  brandName: string;
  checkinPath: string;
  publicUrl?: string;
  radiusM: number;
  lat: number;
  lng: number;
};

const OFFICIAL_URL = "https://opallab.vercel.app/attendance/checkin";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return formatDate(iso);
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceQrAdminPage() {
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsUser, setLogsUser] = useState<EmployeeRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const checkinUrl = useMemo(() => {
    return config?.publicUrl || OFFICIAL_URL;
  }, [config]);

  const qrSrc = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encodeURIComponent(checkinUrl)}`;
  }, [checkinUrl]);

  const reload = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ employees: EmployeeRow[]; config: Config }>("/api/attendance/devices")
      .then((data) => {
        setEmployees(data.employees || []);
        setConfig(data.config);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(checkinUrl);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("העתקה נכשלה");
    }
  }

  async function downloadPng() {
    try {
      const res = await fetch(qrSrc);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "opal-lab-attendance-qr.png";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("הורדת PNG");
    } catch {
      toast.error("הורדה נכשלה");
    }
  }

  function printQr() {
    const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!w) {
      toast.error("יש לאפשר חלונות קופצים להדפסה");
      return;
    }
    w.document.write(`<!doctype html><html dir="rtl"><head><title>QR נוכחות</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#0f172a}
        h1{font-size:28px;margin:0 0 8px}
        p{color:#64748b;margin:4px 0 24px}
        img{width:360px;height:360px;border:1px solid #e2e8f0;border-radius:16px;padding:12px}
        .url{font-size:13px;word-break:break-all;margin-top:20px}
      </style></head><body>
      <h1>${config?.brandName || "OPAL LAB"}</h1>
      <p>סריקת נוכחות — QR בלבד</p>
      <img src="${qrSrc}" alt="QR" />
      <p class="url">${checkinUrl}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  async function resetDevice(row: EmployeeRow) {
    if (!row.deviceRowId) {
      toast.error("אין מכשיר לאיפוס");
      return;
    }
    if (!confirm("לאפס מכשיר? העובד יצטרך הרשמה חד־פעמית מחדש.")) return;
    try {
      await apiClient.patch("/api/attendance/devices", {
        id: row.deviceRowId,
        action: "reset",
      });
      toast.success("המכשיר אופס");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteDevice(row: EmployeeRow) {
    if (!row.deviceRowId) {
      toast.error("אין מכשיר למחיקה");
      return;
    }
    if (!confirm("למחוק את הרשמת המכשיר לחלוטין?")) return;
    try {
      await apiClient.patch("/api/attendance/devices", {
        id: row.deviceRowId,
        action: "delete",
      });
      toast.success("ההרשמה נמחקה");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reapprove(row: EmployeeRow) {
    if (!row.deviceRowId) {
      toast.error("אין מכשיר לאישור");
      return;
    }
    try {
      await apiClient.patch("/api/attendance/devices", {
        id: row.deviceRowId,
        approved: true,
      });
      toast.success("ההרשמה אושרה מחדש");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function openLogs(row: EmployeeRow) {
    setLogsUser(row);
    setLogsLoading(true);
    setLogs([]);
    try {
      const data = await apiClient.get<{ logs: LogRow[] }>(
        `/api/attendance/devices?view=logs&userId=${encodeURIComponent(row.userId)}`
      );
      setLogs(data.logs || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLogsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <QrCode className="h-6 w-6" />
          QR לנוכחות
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          נוכחות באמצעות QR בלבד · {config?.brandName || "OPAL LAB"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div
          ref={printRef}
          className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-xs font-bold tracking-wide text-slate-400">
            קוד לסריקה
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR נוכחות"
            className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-slate-100 bg-white p-3"
          />
          <p className="mt-4 break-all text-xs font-medium text-slate-600">
            {checkinUrl}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => void copyLink()}>
              <Copy className="h-3.5 w-3.5" />
              העתקה
            </Button>
            <Button size="sm" variant="secondary" onClick={printQr}>
              <Printer className="h-3.5 w-3.5" />
              הדפסה
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void downloadPng()}>
              <Download className="h-3.5 w-3.5" />
              PNG
            </Button>
            <Button size="sm" variant="secondary" onClick={printQr}>
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
          {config && (
            <p className="mt-4 text-[11px] text-slate-400">
              רדיוס מותר: {config.radiusM} מ׳ · מיקום מעבדה: {config.lat.toFixed(5)},{" "}
              {config.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              הרשמת עובדים
            </h2>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              רענון
            </button>
          </div>

          {loading && (
            <p className="py-8 text-center text-sm text-slate-400">טוען…</p>
          )}

          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                    <th className="px-2 py-2 font-semibold">עובד</th>
                    <th className="px-2 py-2 font-semibold">תפקיד</th>
                    <th className="px-2 py-2 font-semibold">סטטוס</th>
                    <th className="px-2 py-2 font-semibold">תאריך הרשמה</th>
                    <th className="px-2 py-2 font-semibold">שעה</th>
                    <th className="px-2 py-2 font-semibold">מכשיר אחרון</th>
                    <th className="px-2 py-2 font-semibold">מערכת</th>
                    <th className="px-2 py-2 font-semibold">דפדפן</th>
                    <th className="px-2 py-2 font-semibold">כניסה אחרונה</th>
                    <th className="px-2 py-2 font-semibold">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employees.map((row) => (
                    <tr key={row.userId} className="align-top">
                      <td className="px-2 py-3 font-semibold text-slate-900">
                        {row.userName}
                      </td>
                      <td className="px-2 py-3 text-slate-600">{row.roleLabel}</td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {row.registered ? (
                          <span className="text-emerald-700">🟢 מכשיר רשום</span>
                        ) : (
                          <span className="text-red-600">🔴 עדיין לא נרשם</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {fmtDate(row.enrolledAt)}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {fmtTime(row.enrolledAt)}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {row.deviceType || "—"}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {row.osName || "—"}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {row.browserName || "—"}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {row.lastCheckInAt
                          ? `${fmtDate(row.lastCheckInAt)} ${fmtTime(row.lastCheckInAt)}`
                          : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => void resetDevice(row)}
                            disabled={!row.deviceRowId}
                            className="rounded border border-amber-200 px-2 py-1 text-[11px] font-bold text-amber-800 disabled:opacity-40"
                          >
                            איפוס מכשיר
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteDevice(row)}
                            disabled={!row.deviceRowId}
                            className="rounded border border-red-200 px-2 py-1 text-[11px] font-bold text-red-700 disabled:opacity-40"
                          >
                            מחיקת הרשמה
                          </button>
                          <button
                            type="button"
                            onClick={() => void reapprove(row)}
                            disabled={!row.deviceRowId}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-40"
                          >
                            אישור מחדש
                          </button>
                          <button
                            type="button"
                            onClick={() => void openLogs(row)}
                            className="rounded bg-slate-900 px-2 py-1 text-[11px] font-bold text-white"
                          >
                            לוגי כניסה
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {employees.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">
                  אין עובדים במערכת
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {logsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="font-bold text-slate-900">לוגי כניסה</p>
                <p className="text-xs text-slate-500">{logsUser.userName}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogsUser(null)}
                className="rounded-lg border p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {logsLoading && (
                <p className="py-6 text-center text-sm text-slate-400">טוען…</p>
              )}
              {!logsLoading && logs.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  אין רשומות נוכחות
                </p>
              )}
              <ul className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <li key={l.id} className="py-3 text-sm">
                    <p className="font-semibold text-slate-900">
                      כניסה {fmtDate(l.checkedInAt)} {fmtTime(l.checkedInAt)}
                      {l.checkedOutAt
                        ? ` · יציאה ${fmtTime(l.checkedOutAt)}`
                        : " · פתוח"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {l.deviceType || "מכשיר"} · {l.osName || "OS"} · IP{" "}
                      {l.ipAddress || "—"} · {l.source || "qr"}
                    </p>
                    {(l.latitude != null || l.longitude != null) && (
                      <p className="text-[11px] text-slate-400">
                        GPS: {l.latitude?.toFixed(5)}, {l.longitude?.toFixed(5)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
