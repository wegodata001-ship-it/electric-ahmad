import { NextRequest } from "next/server";
import { ProjectRoomsRepository } from "@/repositories/project-rooms.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireProjectPermission } from "@/lib/auth/assert-office";

type Ctx = { params: Promise<{ id: string; roomId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id: projectId, roomId } = await ctx.params;
    await requireProjectPermission("edit_draft", projectId);
    const existing = await ProjectRoomsRepository.getById(roomId);
    if (!existing || existing.projectId !== projectId) {
      return apiError("חדר לא נמצא", 404);
    }
    const body = await req.json();

    if (body.move === "left" || body.move === "right" || body.move === "up" || body.move === "down") {
      const items = await ProjectRoomsRepository.move(roomId, body.move);
      return apiSuccess({ items });
    }

    const room = await ProjectRoomsRepository.update(roomId, {
      name: body.name,
      floor: body.floor,
      code: body.code,
      sortOrder: body.sortOrder,
      isHidden: body.isHidden,
    });
    return apiSuccess(room);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: projectId, roomId } = await ctx.params;
    await requireProjectPermission("delete", projectId);
    const existing = await ProjectRoomsRepository.getById(roomId);
    if (!existing || existing.projectId !== projectId) {
      return apiError("חדר לא נמצא", 404);
    }
    const result = await ProjectRoomsRepository.softDelete(roomId);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
