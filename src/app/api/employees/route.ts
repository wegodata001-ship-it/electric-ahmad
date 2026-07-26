import { NextRequest } from "next/server";
import { EmployeesRepository } from "@/repositories/employees.repository";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await requireOfficeAuth();
    const projectId = request.nextUrl.searchParams.get("projectId");
    const active = request.nextUrl.searchParams.get("active");
    const role = request.nextUrl.searchParams.get("role");

    if (projectId) {
      return apiSuccess(await EmployeesRepository.findByProject(projectId));
    }
    if (active === "true") {
      return apiSuccess(await EmployeesRepository.findActive());
    }
    
    // Get all employees
    const employees = await EmployeesRepository.findAll();
    
    // Filter by role if specified
    if (role) {
      const filtered = employees.filter((emp) => emp.role === role);
      return apiSuccess(filtered);
    }
    
    return apiSuccess(employees);
  } catch (error) {
    return handleApiError(error);
  }
}
