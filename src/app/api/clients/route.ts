import { NextRequest } from "next/server";
import { ClientsRepository } from "@/repositories/clients.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const sync = request.nextUrl.searchParams.get("sync") !== "0";
    if (sync) {
      await ClientsRepository.syncFromExistingData(userId);
    }
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    return apiSuccess(await ClientsRepository.findAll(q));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();
    const client = await ClientsRepository.create(
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
    return apiSuccess(client, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
