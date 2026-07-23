import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { WorkflowRepository } from "@/repositories/workflow.repository";
import { WorkflowTransitionError } from "@/lib/workflow/status-engine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

async function requireOfficeOrField() {
  try {
    const session = await requireOfficeUser();
    return {
      userId: session.userId,
      role: session.role,
      name: session.userName,
    };
  } catch {
    const session = await requireFieldManager();
    return {
      userId: session.userId,
      role: session.role,
      name: session.userName,
    };
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeOrField();
    const { id } = await ctx.params;
    const doc = await WorkflowRepository.getById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);
    const messages = await WorkflowRepository.listConversation(id);
    return apiSuccess({ documentId: id, messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeOrField();
    const { id } = await ctx.params;
    const doc = await WorkflowRepository.getById(id);
    if (!doc) return apiError("מסמך לא נמצא", 404);

    const body = await req.json();
    const text = String(body.body ?? body.message ?? "").trim();
    if (!text) return apiError("הודעה ריקה", 400);

    const message = await WorkflowRepository.addConversationMessage(id, session, text);
    return apiSuccess(message, 201);
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}
