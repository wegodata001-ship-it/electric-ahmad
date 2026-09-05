import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { listDocumentApprovers } from "@/lib/approvers/list-approvers";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Field managers pick approvers when submitting a document */
export async function GET(req: NextRequest) {
  try {
    await requireFieldManager();
    const projectId = req.nextUrl.searchParams.get("projectId");
    const items = await listDocumentApprovers({ projectId });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
