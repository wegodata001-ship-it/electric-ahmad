import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireProjectPermission("view_all", id);
    const data = await ProjectsRepository.findById(id);
    if (!data) return apiError("פרויקט לא נמצא", 404);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireOfficeUser();
    if (!canAssignProjectManager(user.role)) {
      return apiError("אין הרשאה להקצות מנהל פרויקט", 403);
    }

    const { id } = await params;
    const existing = await ProjectsRepository.findById(id);
    if (!existing) return apiError("פרויקט לא נמצא", 404);

    const body = await request.json();
    if (!("ownerId" in body)) {
      return apiError("חסר מנהל פרויקט");
    }

    const ownerId =
      body.ownerId == null || body.ownerId === ""
        ? null
        : String(body.ownerId);
    const project = await ProjectsRepository.assignProjectManager(
      id,
      ownerId,
      user.userId
    );
    return apiSuccess(project);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

/**
 * Critical project removal is a soft delete (archive), never a cascading
 * physical delete. Only the canonical System Manager roles may perform it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireOfficeUser();
    if (!isSystemAdminRole(user.role)) {
      return apiError("רק מנהל מערכת יכול למחוק פרויקט", 403);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : undefined;
    const result = await ProjectsRepository.archive(id, user.userId, reason);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
