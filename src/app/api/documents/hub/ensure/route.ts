import { NextRequest } from "next/server";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = String(body.kind || "");
    const entityId = String(body.entityId || body.documentId || "");
    if (!kind || !entityId) return apiError("חסרים פרטים");
    const projectId = await DocumentsHubRepository.projectIdForEntity(
      kind,
      entityId
    );
    if (!projectId) return apiError("מסמך או פרויקט לא נמצא", 404);
    const session = await requireProjectPermission("create", projectId);

    const result = await DocumentsHubRepository.ensureInArchive({
      kind,
      entityId,
      userId: session.userId,
      baseUrl: req.nextUrl.origin,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
