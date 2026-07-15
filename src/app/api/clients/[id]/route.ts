import { NextRequest } from "next/server";
import { ClientsRepository } from "@/repositories/clients.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await ClientsRepository.findById(id);
    if (!client) return apiError("לקוח לא נמצא", 404);
    return apiSuccess(client);
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
    const client = await ClientsRepository.update(
      id,
      {
        name: body.name,
        clientNumber: body.clientNumber,
        companyName: body.companyName,
        contactName: body.contactName,
        phone: body.phone,
        phoneSecondary: body.phoneSecondary,
        address: body.address,
        city: body.city,
        email: body.email,
        notes: body.notes,
      },
      userId
    );
    return apiSuccess(client);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
