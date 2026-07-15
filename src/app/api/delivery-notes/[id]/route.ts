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
        date: body.date,
        departureTime: body.departureTime,
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
        driverName: body.driverName,
        vehicle: body.vehicle,
        vehicleNumber: body.vehicleNumber,
        externalCarrier: body.externalCarrier,
        deliveryTime: body.deliveryTime,
        destination: body.destination,
        destinationAddress: body.destinationAddress,
        driverNotes: body.driverNotes,
        senderSigned: body.senderSigned,
        receiverSigned: body.receiverSigned,
        receiverName: body.receiverName,
        receivedAt: body.receivedAt,
        equipmentCheckedIntact: body.equipmentCheckedIntact,
        receivedComplete: body.receivedComplete,
        receivedWithNotes: body.receivedWithNotes,
        receiptNotes: body.receiptNotes,
        status: body.status,
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
