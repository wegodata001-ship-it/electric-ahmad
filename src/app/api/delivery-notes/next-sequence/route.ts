import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireOfficeAuth();
    const sequenceNumber = await DeliveryNotesRepository.nextSequence();
    const year = new Date().getFullYear();
    return apiSuccess({
      sequenceNumber,
      noteNumber: `DN-${year}-${String(sequenceNumber).padStart(4, "0")}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
