import { NextRequest } from "next/server";
import { GalleryRepository } from "@/repositories/gallery.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");

    if (recent) return apiSuccess(await GalleryRepository.findRecent(Number(recent)));
    if (projectId) return apiSuccess(await GalleryRepository.findByProject(projectId));
    return apiSuccess(await GalleryRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
