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
      return apiError("אין הרשאה לסיים יומן זה", 403);
    }
    const diary = await WorkDiariesRepository.completeAssignment(
      id,
      session.userId,
      req.nextUrl.origin
    );
    return apiSuccess(diary);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
