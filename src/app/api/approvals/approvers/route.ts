import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { listDocumentApprovers } from "@/lib/approvers/list-approvers";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    try {
      await requireFieldManager();
    } catch {
      await requireOfficeUser();
    }

    const projectId = req.nextUrl.searchParams.get("projectId");
    const items = await listDocumentApprovers({ projectId });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
