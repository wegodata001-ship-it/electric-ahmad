"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Printer, QrCode, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button, useToast } from "@/components/ui";
import { formatDate, formatRelative } from "@/utils/format";

type DeviceRow = {
  id: string;
  deviceId: string;
  label: string | null;
  approved: boolean;
  approvedAt: string | null;
  enrolledAt: string | null;
  lastSeenAt: string | null;
  deviceType: string | null;
  osName: string | null;
  hasSelfie: boolean;
  userName: string | null;
  userEmail: string | null;
};

type Config = {
  brandName: string;
  checkinPath: string;
  radiusM: number;
  lat: number;
  lng: number;
};

export function AttendanceQrAdminPage() {
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  const checkinUrl = useMemo(() => {
    const path = config?.checkinPath || "/attendance/checkin";
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [config]);

  const qrSrc = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encodeURIComponent(checkinUrl)}`;
  }, [checkinUrl]);

  const reload = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ devices: DeviceRow[]; config: Config }>("/api/attendance/devices")
      .then((data) => {
        setDevices(data.devices);
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
    const node = printRef.current;
    if (!node) return;
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
      <p>סריקת נוכחות — QR / NFC</p>
      <img src="${qrSrc}" alt="QR" />
      <p class="url">${checkinUrl}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  function downloadPdf() {
    // Print dialog → Save as PDF
    printQr();
  }

  async function toggleApprove(id: string, approved: boolean) {
    try {
      await apiClient.patch("/api/attendance/devices", { id, approved });
      toast.success(approved ? "המכשיר אושר" : "האישור בוטל");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function resetDevice(id: string) {
    if (!confirm("לאפס הרשמה? העובד יצטרך לבצע אשף הרשמה מחדש.")) return;
    try {
      await apiClient.patch("/api/attendance/devices", { id, action: "reset" });
      toast.success("ההרשמה אופסה — ניתן להירשם מחדש");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteDevice(id: string) {
    if (!confirm("למחוק את המכשיר לחלוטין?")) return;
    try {
      await apiClient.patch("/api/attendance/devices", { id, action: "delete" });
      toast.success("המכשיר נמחק");
      reload();
    } catch (e: any) {
      toast.error(e.message);
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
          אותו קישור ל־QR ול־NFC · {config?.brandName || "OPAL LAB"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
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
            className="mx-auto mt-4 h-64 w-64 rounded-2xl border border-slate-100 bg-white p-3"
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
            <Button size="sm" variant="secondary" onClick={downloadPdf}>
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

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">מכשירים</h2>
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
          {!loading && devices.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              אין מכשירים עדיין — עובד נרשם באשף חד-פעמי אחרי סריקת QR
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {d.userName || "משתמש לא מקושר"}
                    {d.label ? ` · ${d.label}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {d.deviceType || "מכשיר"} · {d.osName || "OS"} ·{" "}
                    {d.enrolledAt
                      ? "רשום / Trusted"
                      : d.approved
                        ? "מאושר"
                        : "ממתין להרשמה"}
                    {d.hasSelfie ? " · יש סלפי" : ""}
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-400">
                    {d.deviceId}
                  </p>
                  {d.lastSeenAt && (
                    <p className="text-[10px] text-slate-400">
                      נראה לאחרונה: {formatRelative(d.lastSeenAt)}
                      {d.enrolledAt
                        ? ` · נרשם: ${formatDate(d.enrolledAt)}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void resetDevice(d.id)}
                    className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-800"
                  >
                    איפוס הרשמה
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteDevice(d.id)}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700"
                  >
                    מחק
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleApprove(d.id, !d.approved)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                      d.approved
                        ? "border border-slate-200 text-slate-600"
                        : "bg-slate-900 text-white"
                    }`}
                  >
                    {d.approved ? "בטל אישור" : "אשר"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
