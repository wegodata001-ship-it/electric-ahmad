import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Active FIELD_MANAGER employees that can receive a work diary. */
export async function GET() {
  try {
    const session = await requireOfficeUser();
    if (
      !hasDocumentPermission(session.role, "create") &&
      !hasDocumentPermission(session.role, "view_all")
    ) {
      return apiError("אין הרשאה", 403);
    }
    const items = await WorkDiariesRepository.listActiveFieldManagers();
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
