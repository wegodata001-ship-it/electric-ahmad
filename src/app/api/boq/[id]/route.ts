import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { BoqItemKind, BoqItemStatus } from "@prisma/client";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { boqUpdateSchema } from "@/lib/validation/schemas";
import { requireProjectPermission } from "@/lib/auth/assert-office";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const item = await BOQRepository.findById(id);
    if (!item) return apiError("סעיף לא נמצא", 404);
    await requireProjectPermission("view_all", item.projectId);
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await BOQRepository.findById(id);
    if (!existing) return apiError("סעיף לא נמצא", 404);
    const session = await requireProjectPermission(
      "edit_draft",
      existing.projectId
    );
    const body = await parseJsonBody(req, boqUpdateSchema);

    if (body.description !== undefined && !body.description) {
      return apiError("יש להזין תיאור");
    }

    const item = await BOQRepository.update(
      id,
      {
        code: body.code,
        description: body.description,
        unit: body.unit,
        contractQuantity: body.contractQuantity,
        unitPrice: body.unitPrice,
        category: body.category,
        notes: body.notes,
        itemKind: body.itemKind as BoqItemKind | undefined,
        status: body.status as BoqItemStatus | undefined,
      },
      session.userId
    );

    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await BOQRepository.findById(id);
    if (!existing) return apiError("סעיף לא נמצא", 404);
    const session = await requireProjectPermission(
      "delete",
      existing.projectId
    );
    await BOQRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
