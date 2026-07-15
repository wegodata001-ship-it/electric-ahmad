import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Office-only journal detail. Field uses /api/field/work-journals/[id]. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();
    const { id } = await params;
    const journal = await WorkJournalsRepository.findById(id);
    if (!journal) return apiError("יומן לא נמצא", 404);
    return apiSuccess(journal);
  } catch (error) {
    return handleApiError(error);
  }
}
