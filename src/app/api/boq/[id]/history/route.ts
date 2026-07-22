import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id } = await ctx.params;
    const item = await BOQRepository.findById(id);
    if (!item) return apiError("סעיף לא נמצא", 404);
    const history = await BOQRepository.getHistory(id);
    return apiSuccess({ item, history });
  } catch (error) {
    return handleApiError(error);
  }
}
