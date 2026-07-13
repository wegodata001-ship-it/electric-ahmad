import { NextRequest } from "next/server";
import { EmployeesRepository } from "@/repositories/employees.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const active = request.nextUrl.searchParams.get("active");

    if (projectId) {
      return apiSuccess(await EmployeesRepository.findByProject(projectId));
    }
    if (active === "true") {
      return apiSuccess(await EmployeesRepository.findActive());
    }
    return apiSuccess(await EmployeesRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
