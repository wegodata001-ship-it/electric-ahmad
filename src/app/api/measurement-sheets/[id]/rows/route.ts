import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const names: string[] = Array.isArray(body.names)
      ? body.names.map(String)
      : body.name
        ? [String(body.name)]
        : [];
    if (!names.length) return apiError("יש להזין שם יחידה");
    const sheet = await MeasurementSheetsRepository.addRows(id, names, session.userId);
    return apiSuccess(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}
