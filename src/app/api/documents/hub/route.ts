import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
} from "@/lib/auth/office-session";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseListQuery } from "@/lib/api/list-query";

/**
 * Auth: HMAC cookie (0 DB) + office-user gate fused into hub list SQL (1 RTT).
 * Same checks as requireOfficeUser — role, password, employee active/not deleted.
 *
 * Pagination: server-side via parseListQuery. Response shape is additive —
 * items[] is preserved and pageInfo/folderCounts are added alongside.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    const sp = req.nextUrl.searchParams;
    const parsed = parseListQuery(sp, { defaultTake: 300, maxTake: 500 });

    const result = await DocumentsHubRepository.listForOffice(payload.userId, {
      projectId: sp.get("projectId") || undefined,
      q: parsed.q || undefined,
      folderId: sp.get("folderId") || undefined,
      take: parsed.take,
      skip: parsed.skip,
      cursor: parsed.cursor,
    });
    if (result.status === "forbidden") {
      throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
    }
    return apiSuccess({
      items: result.items,
      pageInfo: result.pageInfo,
      folderCounts: result.folderCounts,
    });
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
