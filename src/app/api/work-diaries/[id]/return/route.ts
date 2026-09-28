import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "return_for_revision")) {
      return apiError("אין הרשאה להחזרה לתיקון", 403);
    }
    const { id } = await ctx.params;
    const existing = await WorkDiariesRepository.getById(id);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    await assertCanAccessOwnedWdOrDn(session, existing, "return_for_revision");

    const body = await req.json().catch(() => ({}));
    const diary = await WorkDiariesRepository.returnAssignment(
      id,
      session.userId,
      String(body.comment || "")
    );
    return apiSuccess(diary);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
