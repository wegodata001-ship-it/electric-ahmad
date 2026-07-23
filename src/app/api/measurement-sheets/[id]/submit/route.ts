import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** שליחת דוח ביצוע לאישור (תפעול / פרויקט / מנהל עבודה) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds.map(String)
      : body.approverId
        ? [String(body.approverId)]
        : [];

    if (!approverIds.length) {
      return apiError("יש לבחור לפחות מאשר אחד", 400);
    }

    const result = await MeasurementSheetsRepository.submitForApproval(
      id,
      approverIds,
      session.userId,
      req.nextUrl.origin
    );
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
