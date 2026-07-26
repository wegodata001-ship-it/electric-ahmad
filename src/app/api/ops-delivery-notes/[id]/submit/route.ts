import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "send_for_approval")) {
      return apiError("אין הרשאה לשליחה לאישור", 403);
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds.map(String)
      : [];

    const note = await OpsDeliveryNotesRepository.submitForApproval(
      id,
      approverIds,
      session.userId
    );
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}
