"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  detectDeviceMeta,
  getOrCreateDeviceId,
  readGps,
} from "@/lib/attendance/device-client";

type Phase =
  | "loading"
  | "checking"
  | "success"
  | "already"
  | "error"
  | "need_login";

type SuccessState = {
  userName: string;
  at: string;
  action: "check_in" | "check_out";
  already?: boolean;
};

const ERROR_MAP: Record<string, string> = {
  gps_denied: "יש לאשר GPS",
  gps_unavailable: "יש לאשר GPS",
  gps_failed: "יש לאשר GPS",
  device_not_approved: "המכשיר אינו מאושר",
  out_of_range: "אינך נמצא בטווח המעבדה",
  offline: "אין חיבור לאינטרנט",
};

export default function AttendanceCheckinPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [brand, setBrand] = useState("OPAL LAB");
  const [message, setMessage] = useState("ברוכים הבאים – סריקת הנוכחות מתבצעת...");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void runFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runFlow() {
    setPhase("checking");
    setMessage("ברוכים הבאים – סריקת הנוכחות מתבצעת...");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPhase("error");
      setMessage(ERROR_MAP.offline);
      return;
    }

    try {
      // Auth + brand
      const meRes = await fetch("/api/attendance/checkin", { cache: "no-store" });
      if (meRes.status === 401) {
        setPhase("need_login");
        setMessage("יש להתחבר כדי לרשום נוכחות");
        router.replace(`/login?next=${encodeURIComponent("/attendance/checkin")}`);
        return;
      }
      if (!meRes.ok) {
        const j = await meRes.json().catch(() => ({}));
        throw new Error(j.error || "לא ניתן לבצע רישום כעת");
      }
      const meJson = await meRes.json();
      const me = meJson.data ?? meJson;
      if (me.brandName) setBrand(me.brandName);

      setMessage("בודקים מיקום GPS…");
      let gps: { latitude: number; longitude: number; accuracy: number | null };
      try {
        gps = await readGps();
      } catch (e: any) {
        setPhase("error");
        setMessage(ERROR_MAP[e?.message] || ERROR_MAP.gps_denied);
        return;
      }

      setMessage("מאמתים מכשיר וטווח…");
      const deviceId = getOrCreateDeviceId();
      const meta = detectDeviceMeta();
      const source =
        typeof window !== "undefined" &&
        /nfc|android.*intent/i.test(navigator.userAgent)
          ? "nfc"
          : "qr";

      const postRes = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracy,
          deviceId,
          ...meta,
          source,
        }),
      });

      const postJson = await postRes.json().catch(() => ({}));
      if (!postRes.ok || postJson.success === false) {
        const err = String(postJson.error || "לא ניתן לבצע רישום כעת");
        setPhase("error");
        if (/מאושר/.test(err)) setMessage(ERROR_MAP.device_not_approved);
        else if (/טווח|מעבדה/.test(err)) setMessage(ERROR_MAP.out_of_range);
        else if (/GPS|מיקום/.test(err)) setMessage(ERROR_MAP.gps_denied);
        else setMessage(err);
        return;
      }

      const data = postJson.data ?? postJson;
      setSuccess({
        userName: data.userName,
        at: data.at,
        action: data.action,
        already: data.status === "already_recorded",
      });
      setPhase(data.status === "already_recorded" ? "already" : "success");
    } catch (e: any) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setPhase("error");
        setMessage(ERROR_MAP.offline);
        return;
      }
      setPhase("error");
      setMessage(e?.message || "לא ניתן לבצע רישום כעת");
    }
  }

  const timeLabel = success
    ? new Date(success.at).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-10"
      dir="rtl"
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg">
          <span className="text-lg font-black tracking-tight">OL</span>
        </div>
        <p className="text-xs font-bold tracking-[0.2em] text-slate-400">
          {brand}
        </p>

        {(phase === "loading" || phase === "checking" || phase === "need_login") && (
          <div className="mt-8 space-y-4">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <h1 className="text-xl font-black text-slate-900">{message}</h1>
            <p className="text-sm text-slate-500">אין צורך ללחוץ על כפתור</p>
          </div>
        )}

        {(phase === "success" || phase === "already") && success && (
          <div className="mt-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white shadow-md">
              ✓
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              {phase === "already"
                ? "הנוכחות כבר נרשמה"
                : "הנוכחות נרשמה בהצלחה"}
            </h1>
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 text-right shadow-sm">
              <Row label="עובד" value={success.userName} />
              <Row label="שעה" value={timeLabel} />
              <Row
                label="פעולה שבוצעה"
                value={success.action === "check_in" ? "כניסה" : "יציאה"}
              />
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl text-white shadow-md">
              !
            </div>
            <h1 className="text-xl font-black text-slate-900">{message}</h1>
            <button
              type="button"
              onClick={() => {
                void runFlow();
              }}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white"
            >
              נסה שוב
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}
