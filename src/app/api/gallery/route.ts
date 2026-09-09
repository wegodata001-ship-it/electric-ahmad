import { NextRequest } from "next/server";
import { GalleryRepository } from "@/repositories/gallery.repository";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("view_all");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");

    if (projectId) await requireProjectPermission("view_all", projectId);
    const assigned = await listProjectsForRole({
      userId: session.userId,
      role: session.role,
      mode: "assigned",
    });
    const projectIds =
      session.role === "PROJECT_MANAGER"
        ? assigned.map((project) => project.id)
        : undefined;
    if (recent) {
      return apiSuccess(
        await GalleryRepository.findRecent(Number(recent), projectIds)
      );
    }
    if (projectId) return apiSuccess(await GalleryRepository.findByProject(projectId));
    return apiSuccess(await GalleryRepository.findAll(projectIds));
  } catch (error) {
    return handleApiError(error);
  }
}
