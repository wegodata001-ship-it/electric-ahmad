import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { FieldAttendanceRepository } from "@/repositories/field-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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

    if (action === "check_in") {
      if (body.projectId) {
        await assertProjectSelectable(body.projectId);
      }
      const attendance = await FieldAttendanceRepository.checkIn(
        session.foremanId,
        body.projectId
      );
      return apiSuccess({ attendance, checkedIn: true });
    }

    if (action === "check_out") {
      const attendance = await FieldAttendanceRepository.checkOut(
        session.foremanId
      );
      return apiSuccess({ attendance, checkedIn: false });
    }

    return apiError("פעולה לא חוקית");
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
