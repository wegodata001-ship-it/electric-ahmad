import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const doc = await DocumentsRepository.findById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);
    return apiSuccess(doc);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await ctx.params;
    await DocumentsRepository.delete(id, userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
