import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    if (existing.foremanId !== session.foremanId) {
      return apiError("אין הרשאה", 403);
    }

    const body = await req.json();
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds.map(String)
      : [];

    const diary = await WorkDiariesRepository.submitForApproval(
      id,
      approverIds,
      session.userId
    );
    return apiSuccess(diary);
  } catch (error) {
    return handleApiError(error);
  }
}
