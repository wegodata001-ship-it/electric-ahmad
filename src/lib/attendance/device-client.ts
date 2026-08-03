"use client";

const DEVICE_KEY = "opal-attendance-device-id-v1";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id && id.length >= 8) return id;
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `tmp-${Date.now()}`;
  }
}

export function detectBrowserName(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "דפדפן";
}

export function detectDeviceMeta() {
  if (typeof navigator === "undefined") {
    return {
      deviceType: "unknown",
      osName: "unknown",
      browserName: "unknown",
      userAgent: "",
    };
  }
  const ua = navigator.userAgent || "";
  let deviceType = "desktop";
  if (/iPad|Tablet/i.test(ua)) deviceType = "tablet";
  else if (/Mobile|Android|iPhone/i.test(ua)) deviceType = "mobile";

  let osName = "unknown";
  if (/Windows/i.test(ua)) osName = "Windows";
  else if (/Android/i.test(ua)) osName = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) osName = "iOS";
  else if (/Mac OS/i.test(ua)) osName = "macOS";
  else if (/Linux/i.test(ua)) osName = "Linux";

  return {
    deviceType,
    osName,
    browserName: detectBrowserName(ua),
    userAgent: ua.slice(0, 500),
  };
}

export function readGps(opts?: {
  /** Prefer cached fix for fast daily punches (ms). Default 20s. */
  maximumAgeMs?: number;
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("gps_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("gps_denied"));
        else reject(new Error("gps_failed"));
      },
      {
        enableHighAccuracy: opts?.enableHighAccuracy ?? false,
        timeout: opts?.timeoutMs ?? 10_000,
        maximumAge: opts?.maximumAgeMs ?? 20_000,
      }
    );
  });
}
