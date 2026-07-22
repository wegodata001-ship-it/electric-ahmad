import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { WorkflowTransitionError } from "@/lib/workflow/status-engine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkflowAction } from "@/lib/workflow/types";

type Ctx = { params: Promise<{ id: string }> };

/** מעבר סטטוס רגיל במנוע ה-Workflow */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const action = body.action as WorkflowAction;
    if (!action) return apiError("חסרה פעולה (action)", 400);

    const doc = await WorkflowRepository.transition({
      documentId: id,
      action,
      comment: body.comment,
      approverIds: Array.isArray(body.approverIds) ? body.approverIds : undefined,
      actor: {
        userId: session.userId,
        role: session.role,
        name: session.userName,
      },
    });
    return apiSuccess(doc);
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}
