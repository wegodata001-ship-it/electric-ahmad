import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody, ValidationError } from "@/lib/validation/parse-body";
import { measurementSheetSubmitSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** שליחת דוח ביצוע לאישור (תפעול / פרויקט / מנהל עבודה) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, measurementSheetSubmitSchema);
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds
      : body.approverId
        ? [body.approverId]
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
    if (error instanceof ValidationError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
