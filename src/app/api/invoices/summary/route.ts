import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    await requireOfficeUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return apiError("חסר projectId");
    const sheetIds = req.nextUrl.searchParams.get("sheetIds");
    const ids = sheetIds ? sheetIds.split(",").filter(Boolean) : undefined;
    const summary = await MeasurementSheetsRepository.getProjectSummary(projectId, ids);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה להפקת חשבון מדף מדידה", 403);
    }
    const body = await req.json();
    if (!body.projectId) return apiError("חסר פרויקט");
    const result = await MeasurementSheetsRepository.generateInvoice(
      String(body.projectId),
      {
        sheetIds: Array.isArray(body.sheetIds) ? body.sheetIds.map(String) : undefined,
        billingMonth: body.billingMonth,
        createDocumentFolder: body.createDocumentFolder !== false,
        notes: body.notes,
      },
      session.userId
    );
    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
