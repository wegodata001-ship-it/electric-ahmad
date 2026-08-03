import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { AttendanceCheckinRepository } from "@/repositories/attendance-checkin.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { defaultAttendanceLabConfig } from "@/lib/attendance/lab-config";

export async function GET() {
  try {
    const user = await requireOfficeUser();
    if (!isSystemAdminRole(user.role)) {
      return apiError("רק מנהל מערכת", 403);
    }
    const devices = await AttendanceCheckinRepository.listDevices();
    const config = await AttendanceCheckinRepository.getConfig();
    const defaults = defaultAttendanceLabConfig();
    return apiSuccess({
      devices: devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        label: d.label,
        approved: d.approved,
        approvedAt: d.approvedAt?.toISOString() ?? null,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        deviceType: d.deviceType,
        osName: d.osName,
        userName: d.user?.name ?? null,
        userEmail: d.user?.email ?? null,
      })),
      config: {
        brandName: config.brandName,
        checkinPath: config.checkinPath || defaults.checkinPath,
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
    if (!isSystemAdminRole(user.role)) {
      return apiError("רק מנהל מערכת", 403);
    }
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return apiError("חסר מזהה מכשיר");
    const approved = Boolean(body.approved);
    const row = await AttendanceCheckinRepository.setDeviceApproved(
      id,
      approved,
      user.userId
    );
    return apiSuccess({
      id: row.id,
      approved: row.approved,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
