import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
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
    const session = await requireOfficeUser();
    const { id, attachmentId } = await params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, note, "edit_draft");
    await DeliveryNotesRepository.deleteAttachment(id, attachmentId);
    await AuditRepository.log({
      action: "DELETE",
      entityType: "DeliveryNoteAttachment",
      entityId: attachmentId,
      userId: session.userId,
      metadata: { deliveryNoteId: id },
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
