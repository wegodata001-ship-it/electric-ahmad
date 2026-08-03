import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { getClientIp } from "@/lib/security/rate-limit";
import { AttendanceCheckinRepository } from "@/repositories/attendance-checkin.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Config + enrollment status for the check-in page */
export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const config = await AttendanceCheckinRepository.getConfig();
    const deviceId = req.nextUrl.searchParams.get("deviceId")?.trim() || "";
    const deviceStatus = await AttendanceCheckinRepository.getDeviceStatus(
      deviceId,
      session.userId
    );
    const open = await (
      await import("@/repositories/office-attendance.repository")
    ).OfficeAttendanceRepository.getOpen(session.userId);

    return apiSuccess({
      userName: session.userName,
      brandName: config.brandName,
      radiusM: config.radiusM,
      checkedIn: !!open,
      needsEnrollment: deviceStatus.needsEnrollment,
      deviceTrusted: deviceStatus.deviceTrusted,
      openAttendance: open
        ? {
            id: open.id,
            checkedInAt: open.checkedInAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Auto check-in / check-out after GPS + trusted device validation */
export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await req.json().catch(() => ({}));

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return apiError("יש לאשר GPS", 400);
    }

    const deviceId = String(body.deviceId ?? "").trim();
    if (!deviceId) return apiError("לא ניתן לזהות את המכשיר", 400);

    const result = await AttendanceCheckinRepository.autoToggle(
      session.userId,
      session.userName,
      {
        latitude,
        longitude,
        accuracyMeters:
          body.accuracyMeters != null ? Number(body.accuracyMeters) : null,
        deviceId,
        deviceType: body.deviceType ? String(body.deviceType) : null,
        userAgent: body.userAgent
          ? String(body.userAgent).slice(0, 500)
          : req.headers.get("user-agent"),
        osName: body.osName ? String(body.osName) : null,
        ipAddress: getClientIp(req),
        source: body.source === "nfc" ? "nfc" : "qr",
      }
    );

    if (result.status === "needs_enrollment") {
      return apiSuccess(result);
    }

    if (result.status === "error") {
      const status =
        result.code === "device_not_approved" || result.code === "out_of_range"
          ? 403
          : 400;
      return apiError(result.message, status);
    }

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
