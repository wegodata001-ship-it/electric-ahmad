import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
} from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PmApprovalEditError } from "@/lib/auth/measurement-pm-approval-edit";
import { requireProjectPermission } from "@/lib/auth/assert-office";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Auth: HMAC cookie (0 DB) + office-user gate fused into sheet SQL (1 RTT total).
 * Sheet payload via CTE — no Prisma include fan-out. Response shape unchanged.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    const { id } = await ctx.params;
    const existing = await MeasurementSheetsRepository.getById(id);
    if (!existing) return apiError("דף מדידה לא נמצא", 404);
    await requireProjectPermission("view_all", existing.projectId);
    const result = await MeasurementSheetsRepository.getByIdForOffice(
      id,
      payload.userId
    );

    if (result.status === "forbidden") {
      throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
    }
    if (result.status === "not_found") {
      return apiError("דף מדידה לא נמצא", 404);
    }
    return apiSuccess(result.data);
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
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
    if (body.title !== undefined && !String(body.title).trim()) {
      return apiError("כותרת המדידה לא יכולה להיות ריקה", 400);
    }
    // NOTE: `body.status` is intentionally NOT forwarded — status transitions
    // must go through submit / approve / reject / complete so approvals and
    // signatures are always enforced.
    const sheet = await MeasurementSheetsRepository.updateMeta(
      id,
      {
        title: body.title,
        notes: body.notes,
      },
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
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
