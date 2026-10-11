import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    const data = await SubcontractorsRepository.getMeasurement(id);
    if (data.subcontractorId !== session.subcontractorId) {
      return apiError("אין הרשאה למדידה זו", 403);
    }
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    const data = await SubcontractorsRepository.submitMeasurement(
      id,
      session.userId,
      session.subcontractorId
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
