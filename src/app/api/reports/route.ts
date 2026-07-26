import { NextRequest } from "next/server";
import { ReportsRepository } from "@/repositories/reports.repository";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Legacy WorkReport listing (BOQ quantity reports).
 */
export async function GET(request: NextRequest) {
  try {
    await requireOfficeAuth();
    const { searchParams } = request.nextUrl;
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
  } catch (error) {
    return handleApiError(error);
  }
}
