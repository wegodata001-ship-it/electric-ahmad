import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody, ValidationError } from "@/lib/validation/parse-body";
import { measurementSheetSubmitSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * סיום דף מדידה — שליחה לאישור מנהל תפעול.
 *
 * NOTE: `complete` is now a strict alias for `submit` — a sheet can never
 * become approved without at least one approver. The legacy behaviour that
 * jumped straight to `approved` was removed as part of the workflow hardening.
 */
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
      return apiError("יש לבחור מאשרים", 400);
    }

    const origin = req.nextUrl.origin;
    const result = await MeasurementSheetsRepository.completeSheet(
      id,
      approverIds,
      session.userId,
      origin
    );
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ValidationError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
