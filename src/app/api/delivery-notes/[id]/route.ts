import { NextRequest } from "next/server";
import {
  DeliveryNotesRepository,
  type CreateDeliveryNoteInput,
} from "@/repositories/delivery-notes.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody, ValidationError } from "@/lib/validation/parse-body";
import { deliveryNotePatchSchema } from "@/lib/validation/schemas";
import {
  assertCanAccessOwnedWdOrDn,
  assertCanCreateWdOrDnForProject,
} from "@/lib/auth/cross-project-documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOfficeUser();
    const { id } = await params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, note, "view_all");
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOfficeUser();
    const { id } = await params;
    const existing = await DeliveryNotesRepository.findById(id);
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, existing, "edit_draft");
    const body = await parseJsonBody(request, deliveryNotePatchSchema);
    if (body.projectId && body.projectId !== existing.projectId) {
      await assertCanCreateWdOrDnForProject(
        session,
        String(body.projectId),
        "DELIVERY_NOTE"
      );
    }
    // Zod validates presence + shape; the repository accepts partial updates
    // at runtime even though its input type is nominally required. Cast to
    // preserve the original untyped behaviour without weakening validation.
    const update = {
      noteNumber: body.noteNumber,
      date: body.date,
      status: body.status,
      client: body.client,
      clientId: body.clientId,
      projectId: body.projectId,
      orderNumber: body.orderNumber,
      contactName: body.contactName,
      phone: body.phone,
      phoneSecondary: body.phoneSecondary,
      address: body.address,
      city: body.city,
      notes: body.notes,
      receiverName: body.receiverName,
      receivedAt: body.receivedAt,
      receiverSignatureUrl: body.receiverSignatureUrl,
      employeeSignatureUrl: body.employeeSignatureUrl,
      employeeSignedName: body.employeeSignedName,
      senderSigned: body.senderSigned,
      receiverSigned: body.receiverSigned,
      driverName: body.driverName,
      driverPhone: body.driverPhone,
      vehicle: body.vehicle,
      vehicleNumber: body.vehicleNumber,
      externalCarrier: body.externalCarrier,
      deliveryTime: body.deliveryTime,
      destination: body.destination,
      destinationAddress: body.destinationAddress,
      driverNotes: body.driverNotes,
      items: Array.isArray(body.items) ? body.items : [],
    } as unknown as CreateDeliveryNoteInput;
    const note = await DeliveryNotesRepository.update(id, update, session.userId);
    return apiSuccess(note);
  } catch (error) {
    if (error instanceof ValidationError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireOfficeUser();
    const { id } = await params;
    if (!hasDocumentPermission(user.role, "delete")) {
      return apiError("אין הרשאה למחיקת תעודת משלוח", 403);
    }
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(user, note, "delete");
    await DeliveryNotesRepository.delete(id, user.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
