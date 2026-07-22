import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { ProjectHubRepository } from "@/repositories/project-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id } = await ctx.params;
    const hub = await ProjectHubRepository.getHub(id);
    if (!hub) return apiError("פרויקט לא נמצא", 404);
    return apiSuccess(hub);
  } catch (error) {
    return handleApiError(error);
  }
}
