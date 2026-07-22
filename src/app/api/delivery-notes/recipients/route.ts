import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await getAuthContext();
    const projectId = request.nextUrl.searchParams.get("projectId");
    const items = await DeliveryNotesRepository.listRecipients(projectId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
