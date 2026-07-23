import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** Create missing room×BOQ cells (and seed starter BOQ if project has none). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sheet = await MeasurementSheetsRepository.ensureBoqGrid(
      id,
      session.userId,
      { seedIfEmpty: body?.seedIfEmpty !== false }
    );
    return apiSuccess(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}
