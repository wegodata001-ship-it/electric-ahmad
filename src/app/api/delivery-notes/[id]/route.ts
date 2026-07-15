import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
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
    const { userId } = await getAuthContext();
    const { id } = await params;
    const body = await request.json();
    const note = await DeliveryNotesRepository.update(
      id,
      {
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
      },
      userId
    );
    return apiSuccess(note);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
