"use client";

import { useState } from "react";
import { fieldService } from "@/features/field/services/field.service";
import { apiClient } from "@/lib/api/client";
import { detectDeviceMeta } from "@/lib/attendance/device-client";
import { readGps } from "@/lib/attendance/gps-client";
import type { AttendancePolicy } from "@/lib/settings/attendance-policy";
import { field } from "@/apps/field/field-ui";

/**
 * Soft gate: browsing never blocked.
 * Policy decides when create/start actions prompt for check-in.
 */
export function FieldAttendanceGate({
  open,
  allowSkip,
  onCheckedIn,
  onSkip,
  onCancel,
}: {
  open: boolean;
  allowSkip?: boolean;
  onCheckedIn: () => void;
  onSkip?: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function checkInNow() {
    setBusy(true);
    setError("");
    try {
      const gps = await readGps();
      const device = detectDeviceMeta();
      await fieldService.checkIn({
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracy,
        deviceLabel: `${device.deviceType} · ${device.osName}`,
        userAgent: device.userAgent,
      });
      onCheckedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בכניסה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-black text-[#111827]">
          לא בוצעה כניסה לעבודה
        </h2>
        <p className="text-lg text-[#6B7280]">האם לבצע כניסה עכשיו?</p>
        {error && <p className={field.error}>{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void checkInNow()}
          className={field.btnSuccess}
        >
          {busy ? "…" : "כן, כניסה לעבודה"}
        </button>
        {allowSkip && onSkip && (
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className={field.btnGhost}
          >
            המשך ללא כניסה
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex min-h-14 w-full items-center justify-center text-lg font-bold text-[#6B7280]"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

export async function getAttendancePolicy(): Promise<AttendancePolicy> {
  try {
    const data = await apiClient.get<{ attendancePolicy: AttendancePolicy }>(
      "/api/system/settings"
    );
    return data.attendancePolicy || "optional";
  } catch {
    return "optional";
  }
}

export async function ensureFieldCheckedIn(): Promise<boolean> {
  const dash = await fieldService.getDashboard();
  return !!dash.checkedIn;
}

/** Returns true if action may proceed (checked in or policy allows skip). */
export async function requireAttendanceForAction(
  action: "browse" | "diary" | "delivery" | "start_work"
): Promise<{
  ok: boolean;
  needPrompt: boolean;
  allowSkip: boolean;
  policy: AttendancePolicy;
}> {
  const policy = await getAttendancePolicy();
  if (action === "browse" || policy === "optional") {
    return { ok: true, needPrompt: false, allowSkip: true, policy };
  }

  const checkedIn = await ensureFieldCheckedIn();
  if (checkedIn) {
    return { ok: true, needPrompt: false, allowSkip: false, policy };
  }

  const gated =
    policy === "before_all_actions" ||
    (policy === "before_diary" &&
      (action === "diary" || action === "delivery"));

  if (!gated) {
    return { ok: true, needPrompt: false, allowSkip: true, policy };
  }

  return {
    ok: false,
    needPrompt: true,
    allowSkip: policy !== "before_all_actions",
    policy,
  };
}
