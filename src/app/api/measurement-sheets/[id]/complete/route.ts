import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** סיום דף מדידה — נעילה + שמירה במסמכי הפרויקט */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const origin = req.nextUrl.origin;
    const result = await MeasurementSheetsRepository.completeSheet(
      id,
      session.userId,
      origin
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
