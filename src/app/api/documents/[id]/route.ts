import { NextRequest } from "next/server";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const doc = await DocumentsRepository.findById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);
    await requireProjectPermission("view_all", doc.projectId);
    return apiSuccess(doc);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await requirePermission("delete");
    const { id } = await ctx.params;
    await DocumentsRepository.delete(id, userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
