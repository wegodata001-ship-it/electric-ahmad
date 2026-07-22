import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeUser();
    const { id } = await ctx.params;
    const sheet = await MeasurementSheetsRepository.getById(id);
    if (!sheet) return apiError("דף מדידה לא נמצא", 404);
    return apiSuccess(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const sheet = await MeasurementSheetsRepository.updateMeta(
      id,
      {
        title: body.title,
        notes: body.notes,
        status: body.status,
      },
      session.userId
    );
    return apiSuccess(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}
