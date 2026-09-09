import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { OPERATIONS_MANAGER_ROLE } from "@/lib/auth/roles";
import {
  ProjectManagerAssignmentError,
  ProjectManagerAssignmentsRepository,
} from "@/repositories/project-manager-assignments.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

function canManageAssignments(role: string) {
  return isSystemAdminRole(role) || role === OPERATIONS_MANAGER_ROLE;
}

export async function GET() {
  try {
    const session = await requireOfficeUser();
    if (!canManageAssignments(session.role)) {
      return apiError("אין הרשאה לניהול שיוכי פרויקטים", 403);
    }
    return apiSuccess(await ProjectManagerAssignmentsRepository.list());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canManageAssignments(session.role)) {
      return apiError("אין הרשאה לניהול שיוכי פרויקטים", 403);
    }
    const body = await req.json();
    const userId = String(body.userId ?? "");
    const projectIds = Array.isArray(body.projectIds)
      ? body.projectIds.map(String)
      : [];
    if (!userId) return apiError("יש לבחור מנהל פרויקט");
    return apiSuccess(
      await ProjectManagerAssignmentsRepository.replace(
        userId,
        projectIds,
        session.userId
      )
    );
  } catch (error) {
    if (error instanceof ProjectManagerAssignmentError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
