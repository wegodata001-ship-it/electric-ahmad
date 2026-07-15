import { NextRequest } from "next/server";
import { DailyReportsRepository } from "@/repositories/daily-reports.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { DailyReportStatus } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const report = await DailyReportsRepository.findById(id);
    if (!report) return apiError("דיווח לא נמצא", 404);
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
    const body = await request.json();
    const report = await DailyReportsRepository.updateOffice(
      id,
      {
        officeNotes: body.officeNotes,
        status: body.status as DailyReportStatus | undefined,
      },
      userId
    );
    return apiSuccess(report);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
