import { NextRequest } from "next/server";
import { DocumentsRepository } from "@/repositories/documents.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const recent = request.nextUrl.searchParams.get("recent");

    if (recent) return apiSuccess(await DocumentsRepository.findRecent(Number(recent)));
    if (projectId) return apiSuccess(await DocumentsRepository.findByProject(projectId));
    return apiSuccess(await DocumentsRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
