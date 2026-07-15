import { NextRequest } from "next/server";
import { DailyReportsRepository } from "@/repositories/daily-reports.repository";
import { ReportsRepository } from "@/repositories/reports.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { DailyReportStatus } from "@prisma/client";

/**
 * Default: daily field reports (from work journals).
 * ?legacy=1 — old BOQ WorkReport rows (seed / quantity reports).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const legacy = searchParams.get("legacy") === "1";

    if (legacy) {
      const projectId = searchParams.get("projectId");
      const employeeId = searchParams.get("employeeId");
      const boqItemId = searchParams.get("boqItemId");
      const today = searchParams.get("today");
      const recent = searchParams.get("recent");

      if (boqItemId)
        return apiSuccess(await ReportsRepository.findByBoqItem(boqItemId));
      if (projectId)
        return apiSuccess(await ReportsRepository.findByProject(projectId));
      if (employeeId)
        return apiSuccess(await ReportsRepository.findByEmployee(employeeId));
      if (today === "true")
        return apiSuccess(await ReportsRepository.findToday());
      if (recent)
        return apiSuccess(await ReportsRepository.findRecent(Number(recent)));
      return apiSuccess(await ReportsRepository.findAll());
    }

    const { userId } = await getAuthContext();
    await DailyReportsRepository.backfillMissing(userId);

    const projectId = searchParams.get("projectId") ?? undefined;
    const foremanId =
      searchParams.get("foremanId") ??
      searchParams.get("employeeId") ??
      undefined;
    const status = searchParams.get("status") as DailyReportStatus | null;
    const recent = searchParams.get("recent");

    if (recent) {
      return apiSuccess(
        await DailyReportsRepository.findRecent(Number(recent))
      );
    }

    return apiSuccess(
      await DailyReportsRepository.findAll({
        projectId,
        foremanId,
        status: status || undefined,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
