import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseListQuery } from "@/lib/api/list-query";

export async function GET(request: NextRequest) {
  try {
    await requireOfficeAuth();
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status");
    const parsed = parseListQuery(sp, { defaultTake: 40, maxTake: 200 });

    // Use paged shape when the client asked for pagination or applied filters
    // beyond bare `projectId`. Otherwise keep the legacy array response for BC.
    const usePaged = parsed.paginated || Boolean(parsed.q) || Boolean(status);

    if (usePaged) {
      const result = await DeliveryNotesRepository.listPage({
        projectId,
        q: parsed.q,
        status,
        take: parsed.take,
        skip: parsed.skip,
        sort: parsed.sort,
        dir: parsed.dir,
      });
      return apiSuccess(result);
    }

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
