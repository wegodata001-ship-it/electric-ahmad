import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const diary = await WorkDiariesRepository.getById(id);
    if (!diary) return apiError("יומן עבודה לא נמצא", 404);
    if (diary.foremanId !== session.foremanId) {
      return apiError("אין הרשאה לצפות במסמך זה", 403);
    }
    return apiSuccess(diary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    if (existing.foremanId !== session.foremanId) {
      return apiError("אין הרשאה לערוך מסמך זה", 403);
    }

    const body = await req.json();
    const diary = await WorkDiariesRepository.update(id, {
      projectId: body.projectId,
      workDate: body.workDate ? new Date(body.workDate) : undefined,
      workTime: body.workTime,
      weather: body.weather,
      workType: body.workType,
      workSummary: body.workSummary,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      workItems: body.workItems,
      workers: body.workers,
      equipment: body.equipment,
      materials: body.materials,
      foremanSignatureUrl: body.foremanSignatureUrl,
      foremanSignedName: body.foremanSignedName,
      updatedById: session.userId,
    });
    return apiSuccess(diary);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    if (existing.foremanId !== session.foremanId) {
      return apiError("אין הרשאה למחוק מסמך זה", 403);
    }
    await WorkDiariesRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
