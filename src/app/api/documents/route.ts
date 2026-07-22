import { NextRequest } from "next/server";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");
    const q = request.nextUrl.searchParams.get("q");
    const id = request.nextUrl.searchParams.get("id");
    const migrateGallery = request.nextUrl.searchParams.get("migrateGallery");

    if (migrateGallery === "1") {
      await getAuthContext();
      const result = await DocumentsRepository.migrateGalleryItemsToDocuments();
      return apiSuccess(result);
    }

    if (id) {
      const doc = await DocumentsRepository.findById(id);
      if (!doc) return apiError("מסמך לא נמצא", 404);
      return apiSuccess(doc);
    }

    if (q) {
      return apiSuccess(
        await DocumentsRepository.search(q, projectId ?? undefined)
      );
    }

    if (recent) return apiSuccess(await DocumentsRepository.findRecent(Number(recent)));
    if (projectId) return apiSuccess(await DocumentsRepository.findByProject(projectId));
    return apiSuccess(await DocumentsRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
