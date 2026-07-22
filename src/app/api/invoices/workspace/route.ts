import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    await requireOfficeUser();
    const projectId = req.nextUrl.searchParams.get("projectId");

    if (projectId) {
      const tree = await MeasurementSheetsRepository.getProjectTree(projectId);
      if (!tree) return apiError("פרויקט לא נמצא", 404);
      return apiSuccess(tree);
    }

    const projects = await ProjectsRepository.findAll();
    return apiSuccess({
      projects: projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        contractor: p.contractor,
        location: p.location,
        status: p.status,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireOfficeUser();
    const body = await req.json();
    if (!body.projectId) return apiError("חסר פרויקט");
    if (!body.measurementAxisType) return apiError("חסר סוג יחידה");
    const updated = await MeasurementSheetsRepository.updateProjectAxis(
      String(body.projectId),
      {
        measurementAxisType: body.measurementAxisType,
        measurementAxisLabel: body.measurementAxisLabel,
      }
    );
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
