import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ kind: string; id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { kind, id } = await ctx.params;
    const detail = await DocumentsHubRepository.getDetail(kind, id);
    if (!detail) return apiError("מסמך לא נמצא", 404);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
