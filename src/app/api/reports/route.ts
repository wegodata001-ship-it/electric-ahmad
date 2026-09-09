import { NextRequest } from "next/server";
import { ReportsRepository } from "@/repositories/reports.repository";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Legacy WorkReport listing (BOQ quantity reports).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("view_all");
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");
    const employeeId = searchParams.get("employeeId");
    const boqItemId = searchParams.get("boqItemId");
    const today = searchParams.get("today");
    const recent = searchParams.get("recent");

    if (projectId) {
      await requireProjectPermission("view_all", projectId);
      return apiSuccess(await ReportsRepository.findByProject(projectId));
    }
    const assigned = await listProjectsForRole({
      userId: session.userId,
      role: session.role,
      mode: "assigned",
    });
    const projectIds =
      session.role === "PROJECT_MANAGER"
        ? assigned.map((project) => project.id)
        : undefined;
    if (boqItemId) {
      return apiSuccess(
        await ReportsRepository.findByBoqItem(boqItemId, projectIds)
      );
    }
    if (employeeId)
      return apiSuccess(
        await ReportsRepository.findByEmployee(employeeId, projectIds)
      );
    if (today === "true")
      return apiSuccess(await ReportsRepository.findToday(projectIds));
    if (recent)
      return apiSuccess(
        await ReportsRepository.findRecent(Number(recent), projectIds)
      );
    return apiSuccess(await ReportsRepository.findAll(projectIds));
  } catch (error) {
    return handleApiError(error);
  }
}
