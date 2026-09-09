import { NextRequest } from "next/server";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  requirePermission,
  requireProjectPermission,
  requireSystemAdmin,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("view_all");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");
    const q = request.nextUrl.searchParams.get("q");
    const id = request.nextUrl.searchParams.get("id");
    const migrateGallery = request.nextUrl.searchParams.get("migrateGallery");

    if (migrateGallery === "1") {
      await requireSystemAdmin();
      const result = await DocumentsRepository.migrateGalleryItemsToDocuments();
      return apiSuccess(result);
    }

    if (projectId) {
      await requireProjectPermission("view_all", projectId);
    }
    const assignedProjects = await listProjectsForRole({
      userId: user.userId,
      role: user.role,
      mode: "assigned",
    });
    const scopedProjectIds =
      user.role === "PROJECT_MANAGER"
        ? assignedProjects.map((project) => project.id)
        : undefined;

    if (id) {
      const doc = await DocumentsRepository.findById(id);
      if (!doc) return apiError("מסמך לא נמצא", 404);
      await requireProjectPermission("view_all", doc.projectId);
      return apiSuccess(doc);
    }

    if (q) {
      return apiSuccess(
        await DocumentsRepository.search(
          q,
          projectId ?? undefined,
          scopedProjectIds
        )
      );
    }

    if (recent) {
      return apiSuccess(
        await DocumentsRepository.findRecent(Number(recent), scopedProjectIds)
      );
    }
    if (projectId) return apiSuccess(await DocumentsRepository.findByProject(projectId));
    return apiSuccess(await DocumentsRepository.findAll(scopedProjectIds));
  } catch (error) {
    return handleApiError(error);
  }
}
