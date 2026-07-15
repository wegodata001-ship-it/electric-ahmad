import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { AuditRepository } from "@/repositories/audit.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id, attachmentId } = await params;
    await DeliveryNotesRepository.deleteAttachment(id, attachmentId);
    await AuditRepository.log({
      action: "DELETE",
      entityType: "DeliveryNoteAttachment",
      entityId: attachmentId,
      userId,
      metadata: { deliveryNoteId: id },
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
