import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return apiError("חסר projectId");
    const allowed = await userCanAccessProject({
      userId: session.userId,
      role: session.role,
      projectId,
      scope: "manage",
    });
    if (!allowed) return apiError("אין הרשאה לפרויקט זה", 403);
    const items = await MeasurementSheetsRepository.listByProject(projectId);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await req.json();
    if (!body.projectId) return apiError("יש לבחור פרויקט");
    if (!body.title?.trim()) return apiError("יש להזין כותרת לדף המדידה");

    const allowed = await userCanAccessProject({
      userId: session.userId,
      role: session.role,
      projectId: String(body.projectId),
      scope: "manage",
    });
    if (!allowed) return apiError("אין הרשאה לפרויקט זה", 403);

    const sheet = await MeasurementSheetsRepository.create(
      {
        projectId: String(body.projectId),
        title: String(body.title),
        notes: body.notes,
        rowNames: Array.isArray(body.rowNames) ? body.rowNames.map(String) : [],
        boqItemIds: Array.isArray(body.boqItemIds)
          ? body.boqItemIds.map(String)
          : undefined,
      },
      session.userId
    );
    return apiSuccess(sheet, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
