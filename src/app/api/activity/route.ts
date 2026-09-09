import { NextRequest } from "next/server";
import { ActivityRepository } from "@/repositories/dashboard.repository";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("view_all");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");

    if (projectId) {
      await requireProjectPermission("view_all", projectId);
      return apiSuccess(await ActivityRepository.findByProject(projectId));
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
    if (recent) {
      return apiSuccess(
        await ActivityRepository.findRecent(Number(recent), projectIds)
      );
    }
    return apiSuccess(await ActivityRepository.findAll(projectIds));
  } catch (error) {
    return handleApiError(error);
  }
}
