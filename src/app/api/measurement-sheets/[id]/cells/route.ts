import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
  requireOfficeUser,
} from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PmApprovalEditError } from "@/lib/auth/measurement-pm-approval-edit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Auth: HMAC cookie (0 DB) + office gate fused into cell-save SQL (1 RTT).
 * PM approval-review edit: role + project + pending-approver + expectedVersion.
 * Response shapes unchanged: { saved } | { id, rowId, boqItemId, quantity }.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const approvalReviewEdit = Boolean(body.approvalReviewEdit);

    if (approvalReviewEdit) {
      const session = await requireOfficeUser();
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isFinite(expectedVersion)) {
        return apiError("חסר מספר גרסה לשמירה מאובטחת", 400);
      }

      if (Array.isArray(body.cells)) {
        const result =
          await MeasurementSheetsRepository.saveCellsAsPmApprovalEdit(
            id,
            body.cells.map(
              (c: { rowId: string; boqItemId: string; quantity: number }) => ({
                rowId: String(c.rowId),
                boqItemId: String(c.boqItemId),
                quantity: Number(c.quantity),
              })
            ),
            {
              userId: session.userId,
              role: session.role,
              expectedVersion,
            }
          );
        if (result.status === "forbidden") {
          return apiError("אין הרשאה לערוך דף זה בשלב האישור", 403);
        }
        if (result.status === "not_found") {
          return apiError("דף מדידה לא נמצא", 404);
        }
        if (result.status === "conflict") {
          return apiError(result.message, 409);
        }
        if (result.status === "locked") {
          return apiError("הדף נעול לעריכה", 400);
        }
        return apiSuccess({
          saved: result.saved,
          currentVersion: result.currentVersion,
        });
      }

      if (!body.rowId || !body.boqItemId) return apiError("חסרים פרטי תא");
      const result = await MeasurementSheetsRepository.saveCellsAsPmApprovalEdit(
        id,
        [
          {
            rowId: String(body.rowId),
            boqItemId: String(body.boqItemId),
            quantity: Number(body.quantity),
          },
        ],
        {
          userId: session.userId,
          role: session.role,
          expectedVersion,
        }
      );
      if (result.status === "forbidden") {
        return apiError("אין הרשאה לערוך דף זה בשלב האישור", 403);
      }
      if (result.status === "not_found") {
        return apiError("דף מדידה לא נמצא", 404);
      }
      if (result.status === "conflict") {
        return apiError(result.message, 409);
      }
      if (result.status === "locked") {
        return apiError("הדף נעול לעריכה", 400);
      }
      return apiSuccess({
        ...(result.cells[0] ?? {
          id: "",
          rowId: String(body.rowId),
          boqItemId: String(body.boqItemId),
          quantity: Number(body.quantity) || 0,
        }),
        currentVersion: result.currentVersion,
      });
    }

    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    // Batch save: { cells: [{ rowId, boqItemId, quantity }, ...] }
    if (Array.isArray(body.cells)) {
      const result = await MeasurementSheetsRepository.setCellsBatchForOffice(
        id,
        body.cells.map(
          (c: { rowId: string; boqItemId: string; quantity: number }) => ({
            rowId: String(c.rowId),
            boqItemId: String(c.boqItemId),
            quantity: Number(c.quantity),
          })
        ),
        payload.userId
      );
      if (result.status === "forbidden") {
        throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
      }
      if (result.status === "not_found") {
        return apiError("דף מדידה לא נמצא", 404);
      }
      if (result.status === "locked") {
        return apiError("הדף נעול לעריכה", 400);
      }
      if (result.status === "conflict") {
        return apiError(result.message, 409);
      }
      if (result.status !== "ok") {
        return apiError("שגיאה בשמירה", 400);
      }
      return apiSuccess({ saved: result.saved });
    }

    if (!body.rowId || !body.boqItemId) return apiError("חסרים פרטי תא");
    const result = await MeasurementSheetsRepository.setCellQuantityForOffice(
      id,
      {
        rowId: String(body.rowId),
        boqItemId: String(body.boqItemId),
        quantity: Number(body.quantity),
        note: body.note,
      },
      payload.userId
    );
    if (result.status === "forbidden") {
      throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
    }
    if (result.status === "not_found") {
      return apiError("דף מדידה לא נמצא", 404);
    }
    if (result.status === "locked") {
      return apiError("הדף נעול לעריכה", 400);
    }
    if (result.status !== "ok") {
      return apiError("שגיאה בשמירה", 400);
    }
    return apiSuccess(result.cell);
  } catch (error) {
    if (error instanceof PmApprovalEditError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
