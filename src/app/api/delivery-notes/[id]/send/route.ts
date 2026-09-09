import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** שליחת תעודת משלוח לנמענים */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, note, "send_to_client");
    const body = await request.json().catch(() => ({}));
    const recipientIds: string[] = Array.isArray(body.recipientIds)
      ? body.recipientIds.map(String)
      : [];

    if (!recipientIds.length && !body.includeClient) {
      return apiError("יש לבחור לפחות נמען אחד", 400);
    }

    const result = await DeliveryNotesRepository.sendToRecipients(id, session.userId, {
      recipientIds,
      includeClient: Boolean(body.includeClient),
      notifyInApp: body.notifyInApp !== false,
      sendWhatsApp: Boolean(body.sendWhatsApp),
      sendEmail: Boolean(body.sendEmail),
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
