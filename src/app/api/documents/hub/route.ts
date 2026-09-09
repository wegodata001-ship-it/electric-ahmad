import { NextRequest } from "next/server";
import {
  OfficeAuthError,
} from "@/lib/auth/office-session";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseListQuery } from "@/lib/api/list-query";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

/**
 * Auth: HMAC cookie (0 DB) + office-user gate fused into hub list SQL (1 RTT).
 * Same checks as requireOfficeUser — role, password, employee active/not deleted.
 *
 * Pagination: server-side via parseListQuery. Response shape is additive —
 * items[] is preserved and pageInfo/folderCounts are added alongside.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("view_all");

    const sp = req.nextUrl.searchParams;
    const parsed = parseListQuery(sp, { defaultTake: 300, maxTake: 500 });

    const projectId = sp.get("projectId") || undefined;
    if (projectId && user.role !== PROJECT_MANAGER_ROLE) {
      await requireProjectPermission("view_all", projectId);
    }
    const assignedProjects = await listProjectsForRole({
      userId: user.userId,
      role: user.role,
      mode: "assigned",
    });
    const result = await DocumentsHubRepository.listForOffice(user.userId, {
      projectId,
      q: parsed.q || undefined,
      folderId: sp.get("folderId") || undefined,
      take: parsed.take,
      skip: parsed.skip,
      cursor: parsed.cursor,
      allowedProjectIds:
        user.role === "PROJECT_MANAGER"
          ? assignedProjects.map((project) => project.id)
          : undefined,
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
