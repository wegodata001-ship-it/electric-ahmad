import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול להעביר יומן למנהל שטח אחר", 403);
    }
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, existing, "view_all");

    const body = await req.json();
    if (!body.foremanId) return apiError("יש לבחור מנהל שטח");
    const diary = await WorkDiariesRepository.reassignForeman(
      id,
      String(body.foremanId),
      session.userId
    );
    return apiSuccess(diary);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
