import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { FieldAttendanceRepository } from "@/repositories/field-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

function parseGps(body: any) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    latitude,
    longitude,
    accuracyMeters:
      body.accuracyMeters != null ? Number(body.accuracyMeters) : null,
    deviceLabel: body.deviceLabel ? String(body.deviceLabel).slice(0, 120) : null,
    userAgent: body.userAgent
      ? String(body.userAgent).slice(0, 500)
      : null,
  };
}

export async function GET() {
  try {
    const session = await requireFieldManager();
    const open = await FieldAttendanceRepository.getOpen(session.foremanId);
    return apiSuccess({ attendance: open, checkedIn: !!open });
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
        await assertProjectSelectable(body.projectId);
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
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
