import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** מיגרציית יומנים קיימים למנוע Workflow — System Manager בלבד */
export async function POST() {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("מיגרציה מותרת למנהל מערכת בלבד", 403);
    }
    const result = await WorkDiariesRepository.migrateToWorkflowEngine();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
