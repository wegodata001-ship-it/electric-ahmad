/** הגדרות נוכחות מעבדה (QR בלבד) — AppConfig + env fallback */

export const ATTENDANCE_CONFIG_KEYS = {
  lat: "attendance_lab_lat",
  lng: "attendance_lab_lng",
  radiusM: "attendance_radius_m",
  brand: "attendance_brand_name",
  checkinPath: "attendance_checkin_path",
} as const;

export type AttendanceLabConfig = {
  lat: number;
  lng: number;
  radiusM: number;
  brandName: string;
  checkinPath: string;
};

/** ברירת מחדל — ניתן לעדכן ב־AppConfig / env */
export function defaultAttendanceLabConfig(): AttendanceLabConfig {
  const lat = Number(process.env.ATTENDANCE_LAB_LAT ?? "32.0853");
  const lng = Number(process.env.ATTENDANCE_LAB_LNG ?? "34.7818");
  const radiusM = Number(process.env.ATTENDANCE_RADIUS_M ?? "150");
  return {
    lat: Number.isFinite(lat) ? lat : 32.0853,
    lng: Number.isFinite(lng) ? lng : 34.7818,
    radiusM: Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 150,
    brandName: process.env.ATTENDANCE_BRAND_NAME || "OPAL LAB",
    checkinPath: "/attendance/checkin",
  };
}

/** Haversine distance in meters */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isWithinLabRadius(opts: {
  userLat: number;
  userLng: number;
  labLat: number;
  labLng: number;
  radiusM: number;
}): boolean {
  return (
    distanceMeters(opts.userLat, opts.userLng, opts.labLat, opts.labLng) <=
    opts.radiusM
  );
}

import { ATTENDANCE_DEBOUNCE_MS as DEBOUNCE } from "@/lib/attendance/attendance-rules";

/** @deprecated import from attendance-rules — kept for BC */
export const ATTENDANCE_DEBOUNCE_MS = DEBOUNCE;
