import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canManageAttendance } from "@/lib/auth/attendance-permissions";
import { AttendanceCheckinRepository } from "@/repositories/attendance-checkin.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { defaultAttendanceLabConfig } from "@/lib/attendance/lab-config";

const PUBLIC_CHECKIN_URL = "https://opallab.vercel.app/attendance/checkin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireOfficeUser();
    if (!canManageAttendance(user.role)) {
      return apiError("אין הרשאה לניהול נוכחות", 403);
    }

    const view = req.nextUrl.searchParams.get("view") || "roster";
    const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";

    if (view === "logs" && userId) {
      const logs = await AttendanceCheckinRepository.listAttendanceLogs(userId);
      return apiSuccess({
        logs: logs.map((l) => ({
          id: l.id,
          checkedInAt: l.checkedInAt.toISOString(),
          checkedOutAt: l.checkedOutAt?.toISOString() ?? null,
          source: l.source || "qr",
          latitude: l.latitude,
          longitude: l.longitude,
          ipAddress: l.ipAddress,
          deviceId: l.deviceId,
          deviceType: l.deviceType,
          osName: l.osName,
          userAgent: l.userAgent,
          accuracyMeters: l.accuracyMeters,
        })),
      });
    }

    const [employees, devices, config] = await Promise.all([
      AttendanceCheckinRepository.listEmployeeRoster(),
      AttendanceCheckinRepository.listDevices(),
      AttendanceCheckinRepository.getConfig(),
    ]);
    const defaults = defaultAttendanceLabConfig();

    return apiSuccess({
      employees,
      devices: devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        label: d.label,
        approved: d.approved,
        approvedAt: d.approvedAt?.toISOString() ?? null,
        enrolledAt: d.enrolledAt?.toISOString() ?? null,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        deviceType: d.deviceType,
        osName: d.osName,
        hasSelfie: Boolean(d.selfieUrl),
        userId: d.userId,
        userName: d.user?.name ?? null,
        userEmail: d.user?.email ?? null,
        role: d.user?.role ?? null,
      })),
      config: {
        brandName: config.brandName,
        checkinPath: config.checkinPath || defaults.checkinPath,
        publicUrl: PUBLIC_CHECKIN_URL,
        radiusM: config.radiusM,
        lat: config.lat,
        lng: config.lng,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireOfficeUser();
    if (!canManageAttendance(user.role)) {
      return apiError("אין הרשאה לניהול נוכחות", 403);
    }
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return apiError("חסר מזהה מכשיר");

    const action = String(body.action || "");
    if (action === "reset") {
      const row = await AttendanceCheckinRepository.resetDevice(id, user.userId);
      return apiSuccess({
        id: row.id,
        approved: row.approved,
        enrolledAt: null,
        reset: true,
      });
    }

    if (action === "delete") {
      await AttendanceCheckinRepository.deleteDevice(id, user.userId);
      return apiSuccess({ deleted: true, id });
    }

    const approved = Boolean(body.approved);
    const row = await AttendanceCheckinRepository.setDeviceApproved(
      id,
      approved,
      user.userId
    );
    return apiSuccess({
      id: row.id,
      approved: row.approved,
      enrolledAt: row.enrolledAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
