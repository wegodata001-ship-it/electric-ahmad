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
  | "enroll"
  | "enroll_done"
  | "success"
  | "already"
  | "error"
  | "need_login";

type EnrollStep = 1 | 2 | 3 | 4 | 5;

type SuccessState = {
  userName: string;
  at: string;
  action: "check_in" | "check_out";
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
  const [userName, setUserName] = useState("");
  const [enrollStep, setEnrollStep] = useState<EnrollStep>(1);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [gpsOk, setGpsOk] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const [terms, setTerms] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void bootstrap();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function bootstrap() {
    setPhase("checking");
    setMessage("ברוכים הבאים – סריקת הנוכחות מתבצעת...");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPhase("error");
      setMessage(ERROR_MAP.offline);
      return;
    }

    const deviceId = getOrCreateDeviceId();

    try {
      const meRes = await fetch(
        `/api/attendance/checkin?deviceId=${encodeURIComponent(deviceId)}`,
        { cache: "no-store" }
      );
      if (meRes.status === 401) {
        setPhase("need_login");
        setMessage("שלב 1: התחברות לחשבון העובד");
        router.replace(
          `/login?next=${encodeURIComponent("/attendance/checkin")}`
        );
        return;
      }
      if (!meRes.ok) {
        const j = await meRes.json().catch(() => ({}));
        throw new Error(j.error || "לא ניתן לבצע רישום כעת");
      }
      const meJson = await meRes.json();
      const me = meJson.data ?? meJson;
      if (me.brandName) setBrand(me.brandName);
      setUserName(me.userName || "");

      if (me.needsEnrollment) {
        setPhase("enroll");
        setEnrollStep(2); // already logged in = step 1 done
        return;
      }

      await performAutoCheckin(deviceId);
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

  async function performAutoCheckin(deviceId: string) {
    setPhase("checking");
    setMessage("ברוכים הבאים – סריקת הנוכחות מתבצעת...");

    let gps: { latitude: number; longitude: number; accuracy: number | null };
    try {
      setMessage("בודקים מיקום GPS…");
      gps = await readGps();
    } catch (e: any) {
      setPhase("error");
      setMessage(ERROR_MAP[e?.message] || ERROR_MAP.gps_denied);
      return;
    }

    setMessage("מאמתים מכשיר וטווח…");
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
    const data = postJson.data ?? postJson;

    if (data?.status === "needs_enrollment") {
      setPhase("enroll");
      setEnrollStep(2);
      return;
    }

    if (!postRes.ok || postJson.success === false) {
      const err = String(postJson.error || "לא ניתן לבצע רישום כעת");
      setPhase("error");
      if (/מאושר|הרשמה/.test(err)) {
        setPhase("enroll");
        setEnrollStep(2);
        return;
      }
      if (/טווח|מעבדה/.test(err)) setMessage(ERROR_MAP.out_of_range);
      else if (/GPS|מיקום/.test(err)) setMessage(ERROR_MAP.gps_denied);
      else setMessage(err);
      return;
    }

    setSuccess({
      userName: data.userName,
      at: data.at,
      action: data.action,
    });
    setPhase(data.status === "already_recorded" ? "already" : "success");
  }

  async function startCamera() {
    setEnrollError("");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setEnrollError("לא ניתן לפתוח את המצלמה — יש לאשר הרשאת מצלמה");
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480, 640);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = Math.max(0, ((video.videoWidth || size) - size) / 2);
    const sy = Math.max(0, ((video.videoHeight || size) - size) / 2);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setSelfie(dataUrl);
    stopCamera();
  }

  async function requestGps() {
    setEnrollError("");
    try {
      const gps = await readGps();
      setGpsCoords(gps);
      setGpsOk(true);
      setEnrollStep(4);
    } catch (e: any) {
      setEnrollError(ERROR_MAP[e?.message] || ERROR_MAP.gps_denied);
      setGpsOk(false);
    }
  }

  async function finishEnroll() {
    if (!selfie || !gpsCoords) {
      setEnrollError("חסרים סלפי או GPS");
      return;
    }
    setEnrollBusy(true);
    setEnrollError("");
    try {
      const deviceId = getOrCreateDeviceId();
      const meta = detectDeviceMeta();
      const res = await fetch("/api/attendance/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          selfieBase64: selfie,
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          termsAccepted: terms,
          ...meta,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "ההרשמה נכשלה");
      }
      stopCamera();
      setPhase("enroll_done");
    } catch (e: any) {
      setEnrollError(e?.message || "ההרשמה נכשלה");
    } finally {
      setEnrollBusy(false);
    }
  }

  useEffect(() => {
    if (phase === "enroll" && enrollStep === 2) {
      void startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enrollStep]);

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
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg">
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

        {phase === "enroll" && (
          <div className="mt-6 space-y-4 text-right">
            <h1 className="text-center text-xl font-black text-slate-900">
              הרשמה חד-פעמית למכשיר
            </h1>
            <p className="text-center text-xs text-slate-500">
              שלב {enrollStep} מתוך 5 · {userName}
            </p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 w-8 rounded-full ${
                    s <= enrollStep ? "bg-slate-900" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {enrollStep === 2 && (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">שלב 2 — צילום סלפי</p>
                {!selfie ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="mx-auto aspect-square w-full max-w-xs rounded-2xl bg-slate-900 object-cover"
                    />
                    <button
                      type="button"
                      onClick={captureSelfie}
                      className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white"
                    >
                      צלם סלפי
                    </button>
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selfie}
                      alt="סלפי"
                      className="mx-auto aspect-square w-full max-w-xs rounded-2xl object-cover"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelfie(null);
                          void startCamera();
                        }}
                        className="flex-1 rounded-2xl border py-3 text-sm font-bold"
                      >
                        צלם מחדש
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnrollStep(3)}
                        className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white"
                      >
                        המשך
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {enrollStep === 3 && (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">שלב 3 — אישור הרשאת GPS</p>
                <p className="text-xs text-slate-500">
                  הנוכחות מאומתת לפי מיקום המעבדה. יש לאשר גישה למיקום.
                </p>
                <button
                  type="button"
                  onClick={() => void requestGps()}
                  className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white"
                >
                  {gpsOk ? "GPS אושר ✓ — המשך" : "אשר GPS"}
                </button>
              </div>
            )}

            {enrollStep === 4 && (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">שלב 4 — תנאי שימוש (אופציונלי)</p>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span>
                    אני מאשר/ת שימוש במיקום ובמכשיר זה לצורך רישום נוכחות במעבדה.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setEnrollStep(5)}
                  className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white"
                >
                  המשך
                </button>
              </div>
            )}

            {enrollStep === 5 && (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">שלב 5 — שמירת מכשיר מאומן</p>
                <p className="text-xs text-slate-500">
                  המכשיר יישמר כ־Trusted Device. מהפעם הבאה מספיק לסרוק את ה־QR.
                </p>
                <button
                  type="button"
                  disabled={enrollBusy}
                  onClick={() => void finishEnroll()}
                  className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {enrollBusy ? "שומר…" : "סיים הרשמה"}
                </button>
              </div>
            )}

            {enrollError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                {enrollError}
              </p>
            )}
          </div>
        )}

        {phase === "enroll_done" && (
          <div className="mt-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white">
              ✓
            </div>
            <h1 className="text-xl font-black text-slate-900">
              ההרשמה הושלמה בהצלחה
            </h1>
            <p className="text-sm text-slate-600">
              מהיום מספיק לסרוק את ה־QR לצורך כניסה ויציאה.
            </p>
            <button
              type="button"
              onClick={() => void performAutoCheckin(getOrCreateDeviceId())}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white"
            >
              המשך לרישום נוכחות
            </button>
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
              onClick={() => void bootstrap()}
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
