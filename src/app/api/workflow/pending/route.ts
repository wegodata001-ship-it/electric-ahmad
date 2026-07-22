import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאת אישור", 403);
    }
    const items = await WorkflowRepository.listPendingForApprover(session.userId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
