import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const recent = request.nextUrl.searchParams.get("recent");

    if (recent) {
      const data = await ProjectsRepository.findRecent(Number(recent));
      return apiSuccess(data);
    }

    const data = status
      ? await ProjectsRepository.findAll(status as "active")
      : await ProjectsRepository.findAll();

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
