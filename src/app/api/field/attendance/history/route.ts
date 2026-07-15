import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import {
  FieldAttendanceRepository,
  type AttendancePeriod,
} from "@/repositories/field-attendance.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireFieldManager();
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as AttendancePeriod;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const allowed: AttendancePeriod[] = [
      "today",
      "week",
      "month",
      "range",
      "all",
    ];
    if (!allowed.includes(period)) {
      return apiError("תקופה לא חוקית");
    }

    const [entries, summary] = await Promise.all([
      FieldAttendanceRepository.listHistory(
        session.foremanId,
        period,
        from,
        to
      ),
      FieldAttendanceRepository.personalSummary(session.foremanId),
    ]);

    return apiSuccess({ entries, summary });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
