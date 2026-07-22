import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkflowDocKind } from "@/lib/workflow/types";

/** רשימה / יצירת מסמך Workflow */
export async function GET(req: NextRequest) {
  try {
    await requireOfficeUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    const kind = req.nextUrl.searchParams.get("kind") as WorkflowDocKind | null;
    if (!projectId) return apiError("projectId נדרש", 400);
    const items = await WorkflowRepository.listByProject(
      projectId,
      kind || undefined
    );
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await req.json();
    const kind = body.kind as WorkflowDocKind;
    const projectId = String(body.projectId ?? "");
    if (!kind || !projectId) return apiError("חסרים kind / projectId", 400);

    const doc = await WorkflowRepository.create({
      kind,
      projectId,
      title: body.title,
      currentOwnerId: body.currentOwnerId,
      sourceDocumentId: body.sourceDocumentId,
      legacyEntityType: body.legacyEntityType,
      legacyEntityId: body.legacyEntityId,
      documentNumber: body.documentNumber,
      actor: {
        userId: session.userId,
        role: session.role,
        name: session.userName,
      },
    });
    return apiSuccess(doc);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
