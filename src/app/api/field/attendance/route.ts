import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import {
  FieldAttendanceRepository,
  FieldAttendanceStateError,
} from "@/repositories/field-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

function parseGps(body: Record<string, unknown>) {
  if (
    body.latitude == null ||
    body.longitude == null ||
    body.latitude === "" ||
    body.longitude === ""
  ) {
    return null;
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracyMeters =
    body.accuracyMeters != null ? Number(body.accuracyMeters) : null;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (accuracyMeters != null &&
      (!Number.isFinite(accuracyMeters) || accuracyMeters < 0))
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    accuracyMeters,
    deviceLabel: body.deviceLabel ? String(body.deviceLabel).slice(0, 120) : null,
    userAgent: body.userAgent
      ? String(body.userAgent).slice(0, 500)
      : null,
  };
}

export async function GET() {
  try {
    const session = await requireFieldManager();
    const [open, todayAttendance] = await Promise.all([
      FieldAttendanceRepository.getOpen(session.foremanId),
      FieldAttendanceRepository.getLatestToday(session.foremanId),
    ]);
    return apiSuccess({
      attendance: open,
      todayAttendance,
      checkedIn: !!open,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    const gps = parseGps(body);
    if (!gps) {
      return apiError("יש לאשר GPS לפני דיווח נוכחות", 400);
    }
    if (!body.userAgent) {
      gps.userAgent = request.headers.get("user-agent");
    }

    if (action === "check_in") {
      if (body.projectId) {
        await assertProjectSelectable(body.projectId, session.foremanId);
      }
      const attendance = await FieldAttendanceRepository.checkIn(
        session.foremanId,
        {
          projectId: body.projectId,
          gps,
          userId: session.userId,
        }
      );
      return apiSuccess({ attendance, checkedIn: true });
    }

    if (action === "check_out") {
      const attendance = await FieldAttendanceRepository.checkOut(
        session.foremanId,
        { gps, userId: session.userId }
      );
      return apiSuccess({ attendance, checkedIn: false });
    }

    return apiError("פעולה לא חוקית");
  } catch (error) {
    if (error instanceof FieldAttendanceStateError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
