import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** שליחת תעודת משלוח לנמענים */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const recipientIds: string[] = Array.isArray(body.recipientIds)
      ? body.recipientIds.map(String)
      : [];

    if (!recipientIds.length && !body.includeClient) {
      return apiError("יש לבחור לפחות נמען אחד", 400);
    }

    const result = await DeliveryNotesRepository.sendToRecipients(id, userId, {
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
