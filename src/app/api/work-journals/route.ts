import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Office-only journals listing.
 * Field managers must use /api/field/work-journals (Field session).
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(request.url);
    const foremanId = searchParams.get("foremanId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") as
      | "draft"
      | "submitted"
      | null;

    const list = await WorkJournalsRepository.listForOffice({
      foremanId,
      projectId,
      status: status ?? undefined,
    });
    return apiSuccess(list);
  } catch (error) {
    return handleApiError(error);
  }
}
