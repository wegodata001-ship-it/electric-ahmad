import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { ProjectRoomsRepository } from "@/repositories/project-rooms.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id: projectId } = await ctx.params;
    const includeHidden =
      req.nextUrl.searchParams.get("includeHidden") === "1";
    const items = await ProjectRoomsRepository.list(projectId, {
      includeHidden,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
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

/** סידור מחדש: body.orderedIds = string[] */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id: projectId } = await ctx.params;
    const body = await req.json();
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map(String)
      : [];
    if (!orderedIds.length) return apiError("חסרה רשימת סדר", 400);
    const items = await ProjectRoomsRepository.reorder(projectId, orderedIds);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
