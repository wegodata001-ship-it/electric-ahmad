import { requireTruckDriver } from "@/lib/auth/driver-session";
import { listMyOfficialDocuments } from "@/lib/documents/official-document";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireTruckDriver();
    const items = await listMyOfficialDocuments(session.userId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
