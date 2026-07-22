import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { WorkflowTransitionError } from "@/lib/workflow/status-engine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkflowStatus } from "@/lib/workflow/types";

type Ctx = { params: Promise<{ id: string }> };

/** עקיפת Workflow — System Manager בלבד */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("עקיפה מותרת למנהל מערכת בלבד", 403);
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const toStatus = body.toStatus as WorkflowStatus;
    if (!toStatus) return apiError("חסר toStatus", 400);

    const doc = await WorkflowRepository.override({
      documentId: id,
      toStatus,
      reason: String(body.reason ?? ""),
      note: String(body.note ?? ""),
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
