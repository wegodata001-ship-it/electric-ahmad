import { NextRequest } from "next/server";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PmApprovalEditError } from "@/lib/auth/measurement-pm-approval-edit";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await MeasurementSheetsRepository.getById(id);
    if (!existing) return apiError("דף מדידה לא נמצא", 404);
    const session = await requireProjectPermission(
      "edit_draft",
      existing.projectId
    );
    const body = await req.json();
    const names: string[] = Array.isArray(body.names)
      ? body.names.map(String)
      : body.name
        ? [String(body.name)]
        : [];
    if (!names.length) return apiError("יש להזין שם יחידה");
    const sheet = await MeasurementSheetsRepository.addRows(
      id,
      names,
      session.userId,
      {
        role: session.role,
        expectedVersion:
          body.expectedVersion != null
            ? Number(body.expectedVersion)
            : undefined,
      }
    );
    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof PmApprovalEditError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await MeasurementSheetsRepository.getById(id);
    if (!existing) return apiError("דף מדידה לא נמצא", 404);
    const session = await requireProjectPermission(
      "edit_draft",
      existing.projectId
    );
    const body = await req.json();
    if (!body.rowId || !body.name?.trim()) {
      return apiError("חסרים מזהה שורה או שם", 400);
    }
    const sheet = await MeasurementSheetsRepository.renameRow(
      id,
      String(body.rowId),
      String(body.name),
      session.userId,
      {
        role: session.role,
        expectedVersion:
          body.expectedVersion != null
            ? Number(body.expectedVersion)
            : undefined,
      }
    );
    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof PmApprovalEditError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await MeasurementSheetsRepository.getById(id);
    if (!existing) return apiError("דף מדידה לא נמצא", 404);
    const session = await requireProjectPermission(
      "edit_draft",
      existing.projectId
    );
    const body = await req.json().catch(() => ({}));
    if (!body.rowId) return apiError("חסר מזהה שורה", 400);
    const sheet = await MeasurementSheetsRepository.deleteRow(
      id,
      String(body.rowId),
      session.userId,
      {
        role: session.role,
        expectedVersion:
          body.expectedVersion != null
            ? Number(body.expectedVersion)
            : undefined,
      }
    );
    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof PmApprovalEditError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
