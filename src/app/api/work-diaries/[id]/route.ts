import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  assertCanAccessOwnedWdOrDn,
} from "@/lib/auth/cross-project-documents";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const diary = await WorkDiariesRepository.getById(id);
    if (!diary) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, diary, "view_all");
    return apiSuccess(diary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, existing, "edit_draft");
    const body = await req.json();
    if (body.projectId && body.projectId !== existing.projectId) {
      return apiError("לא ניתן לשנות פרויקט לאחר יצירת יומן עבודה", 400);
    }
    if (
      body.expectedVersion != null &&
      Number(body.expectedVersion) !== existing.currentVersion
    ) {
      return apiError("המסמך עודכן מאז שפתחת אותו. יש לרענן.", 409);
    }
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
      updatedById: session.userId,
    });
    return apiSuccess(diary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const diary = await WorkDiariesRepository.getById(id);
    if (!diary) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, diary, "delete");
    await WorkDiariesRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
