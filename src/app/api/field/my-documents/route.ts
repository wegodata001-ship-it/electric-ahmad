import { requireFieldManager } from "@/lib/auth/field-session";
import { listMyOfficialDocuments } from "@/lib/documents/official-document";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireFieldManager();
    const items = await listMyOfficialDocuments(session.userId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
