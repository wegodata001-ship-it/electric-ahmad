import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { ProjectRoomsRepository } from "@/repositories/project-rooms.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string; roomId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { roomId } = await ctx.params;
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
    await requireOfficeUser();
    const { roomId } = await ctx.params;
    const result = await ProjectRoomsRepository.softDelete(roomId);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
