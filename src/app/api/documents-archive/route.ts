import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
} from "@/lib/auth/office-session";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Auth fused into archive list SQL (1 RTT). Diaries + delivery notes via CTE UNION.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    const sp = req.nextUrl.searchParams;
    const result = await DocumentsHubRepository.listArchiveForOffice(
      payload.userId,
      {
        kind: sp.get("kind"),
        documentNumber: sp.get("documentNumber") || undefined,
        projectId: sp.get("projectId") || undefined,
        clientName: sp.get("clientName") || undefined,
        status: sp.get("status") || undefined,
        take: 100,
      }
    );
    if (result.status === "forbidden") {
      throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
    }
    return apiSuccess({ items: result.items });
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
