import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id } = await ctx.params;
    const item = await BOQRepository.findById(id);
    if (!item) return apiError("סעיף לא נמצא", 404);
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.description !== undefined && !String(body.description).trim()) {
      return apiError("יש להזין תיאור");
    }

    const item = await BOQRepository.update(
      id,
      {
        code: body.code,
        description: body.description,
        unit: body.unit,
        contractQuantity:
          body.contractQuantity !== undefined ? Number(body.contractQuantity) : undefined,
        unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
        category: body.category,
        notes: body.notes,
        itemKind: body.itemKind,
        status: body.status,
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
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    await BOQRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
