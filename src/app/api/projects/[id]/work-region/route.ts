import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireOfficeUser();
    if (!canAssignProjectManager(user.role)) {
      return apiError("אין הרשאה לשיוך אזור עבודה", 403);
    }
    const { id } = await ctx.params;
    const body = await request.json();
    const workRegionId =
      body.workRegionId == null || body.workRegionId === ""
        ? null
        : String(body.workRegionId);
    const project = await ProjectsRepository.assignWorkRegion(
      id,
      workRegionId,
      user.userId
    );
    return apiSuccess(project);
  } catch (error) {
    return handleApiError(error);
  }
}
