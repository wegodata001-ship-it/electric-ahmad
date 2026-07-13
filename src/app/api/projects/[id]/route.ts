import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await ProjectsRepository.findById(id);
    if (!data) return apiError("פרויקט לא נמצא", 404);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
