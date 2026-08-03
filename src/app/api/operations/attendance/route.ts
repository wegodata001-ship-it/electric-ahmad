import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { OfficeAttendanceRepository } from "@/repositories/office-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Status only — punches go through /attendance/checkin (QR) */
export async function GET() {
  try {
    const session = await requireOfficeUser();
    const attendance = await OfficeAttendanceRepository.getOpen(session.userId);
    return apiSuccess({
      attendance: attendance
        ? {
            id: attendance.id,
            checkedInAt: attendance.checkedInAt.toISOString(),
            checkedOutAt: attendance.checkedOutAt?.toISOString() ?? null,
          }
        : null,
      checkedIn: !!attendance,
      message: "נוכחות מתבצעת רק באמצעות סריקת QR",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_req: NextRequest) {
  return apiError(
    "נוכחות מתבצעת רק באמצעות סריקת QR בכתובת /attendance/checkin",
    403
  );
}
