import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
    const data = projectId
      ? await BOQRepository.findByProject(projectId)
      : await BOQRepository.findAll();
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
