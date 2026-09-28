import { NextRequest } from "next/server";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { OfficeAuthError } from "@/lib/auth/office-session";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.measurementSheet.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!existing) return apiError("דף מדידה לא נמצא", 404);

    const session = await requireProjectPermission("create", existing.projectId);
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול להפיק חשבון במסלול ישיר", 403);
    }

    const result = await MeasurementSheetsRepository.finalizeDirectAndInvoice(
      id,
      session.userId
    );
    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
