import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { OfficeAttendanceRepository } from "@/repositories/office-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "check_in") {
      const attendance = await OfficeAttendanceRepository.checkIn(
        session.userId
      );
      return apiSuccess({
        attendance: {
          id: attendance.id,
          checkedInAt: attendance.checkedInAt.toISOString(),
          checkedOutAt: null,
        },
        checkedIn: true,
      });
    }

    if (action === "check_out") {
      const attendance = await OfficeAttendanceRepository.checkOut(
        session.userId
      );
      return apiSuccess({
        attendance: {
          id: attendance.id,
          checkedInAt: attendance.checkedInAt.toISOString(),
          checkedOutAt: attendance.checkedOutAt?.toISOString() ?? null,
        },
        checkedIn: false,
      });
    }

    return apiError("פעולה לא תקינה", 400);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
