import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) {
      return apiSuccess(await DeliveryNotesRepository.findByProject(projectId));
    }
    return apiSuccess(await DeliveryNotesRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();
    const note = await DeliveryNotesRepository.create(
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
      },
      userId
    );
    return apiSuccess(note, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
