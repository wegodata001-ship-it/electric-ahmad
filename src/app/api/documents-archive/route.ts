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
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

/**
 * Auth fused into archive list SQL (1 RTT). Diaries + delivery notes via CTE UNION.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("view_all");

    const sp = req.nextUrl.searchParams;
    const projectId = sp.get("projectId") || undefined;
    if (projectId && user.role !== PROJECT_MANAGER_ROLE) {
      await requireProjectPermission("view_all", projectId);
    }
    const assignedProjects = await listProjectsForRole({
      userId: user.userId,
      role: user.role,
      mode: "assigned",
    });
    const result = await DocumentsHubRepository.listArchiveForOffice(
      user.userId,
      {
        kind: sp.get("kind"),
        documentNumber: sp.get("documentNumber") || undefined,
        projectId,
        clientName: sp.get("clientName") || undefined,
        status: sp.get("status") || undefined,
        take: 100,
        allowedProjectIds:
          user.role === "PROJECT_MANAGER"
            ? assignedProjects.map((project) => project.id)
            : undefined,
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
