import { NextRequest } from "next/server";
import { ActivityRepository } from "@/repositories/dashboard.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");

    if (projectId) return apiSuccess(await ActivityRepository.findByProject(projectId));
    if (recent) return apiSuccess(await ActivityRepository.findRecent(Number(recent)));
    return apiSuccess(await ActivityRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
