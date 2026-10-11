import { NextRequest } from "next/server";
import { requireSystemAdmin } from "@/lib/auth/assert-office";
import { WorkRegionsRepository } from "@/repositories/work-regions.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireSystemAdmin();
    const { id } = await ctx.params;
    const body = await request.json();
    const item = await WorkRegionsRepository.update(id, {
      name: body.name,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    await requireSystemAdmin();
    const { id } = await ctx.params;
    const item = await WorkRegionsRepository.deactivate(id);
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}
