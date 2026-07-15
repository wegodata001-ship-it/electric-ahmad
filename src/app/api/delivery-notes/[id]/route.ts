import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
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
