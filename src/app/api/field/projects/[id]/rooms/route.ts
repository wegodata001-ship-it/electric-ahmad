import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { ProjectRoomsRepository } from "@/repositories/project-rooms.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** Mobile/Field: רשימה + הוספת חדר מתוך אותו מסך */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireFieldManager();
    const { id: projectId } = await ctx.params;
    const items = await ProjectRoomsRepository.list(projectId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireFieldManager();
    const { id: projectId } = await ctx.params;
    const body = await req.json();
    if (!body.name?.trim()) return apiError("שם החדר חובה", 400);
    const room = await ProjectRoomsRepository.create(projectId, {
      name: String(body.name),
      floor: body.floor ?? null,
      code: body.code ?? null,
      sortOrder: body.sortOrder ?? null,
    });
    return apiSuccess(room);
  } catch (error) {
    return handleApiError(error);
  }
}
