import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
} from "@/lib/auth/office-session";
import { ProjectHubRepository } from "@/repositories/project-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Auth: HMAC cookie (0 DB) + office-user gate fused into hub SQL (1 RTT total).
 * Same checks as requireOfficeUser — role, password, employee active/not deleted.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    const { id } = await ctx.params;
    const result = await ProjectHubRepository.getHub(id, payload.userId);

    if (result.status === "forbidden") {
      throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
    }
    if (result.status === "not_found") {
      return apiError("פרויקט לא נמצא", 404);
    }
    return apiSuccess(result.data);
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
