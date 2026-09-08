import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOfficeAuth();
    const { id } = await params;
    const data = await ProjectsRepository.findById(id);
    if (!data) return apiError("פרויקט לא נמצא", 404);
    return apiSuccess(data);
  } catch (error) {
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
