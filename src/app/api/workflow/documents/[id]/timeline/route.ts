import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id } = await ctx.params;
    const doc = await WorkflowRepository.getById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);
    const timeline = await WorkflowRepository.timeline(id);
    return apiSuccess({ documentId: id, timeline });
  } catch (error) {
    return handleApiError(error);
  }
}
