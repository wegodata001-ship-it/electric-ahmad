import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import { ProjectWorkSitesRepository } from "@/repositories/project-work-sites.repository";
import { WorkRegionsRepository } from "@/repositories/work-regions.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string; siteId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireOfficeUser();
    if (!canAssignProjectManager(user.role)) {
      return apiError("אין הרשאה לשיוך אזור לסניף", 403);
    }
    const { id, siteId } = await ctx.params;
    await requireProjectPermission("create", id);
    const site = await ProjectWorkSitesRepository.getById(siteId);
    if (!site || site.projectId !== id) {
      return apiError("סניף לא נמצא", 404);
    }
    const body = await request.json();
    const workRegionId =
      body.workRegionId == null || body.workRegionId === ""
        ? null
        : String(body.workRegionId);
    await WorkRegionsRepository.assignSiteRegion(siteId, workRegionId);
    return apiSuccess({ id: siteId, workRegionId });
  } catch (error) {
    return handleApiError(error);
  }
}
