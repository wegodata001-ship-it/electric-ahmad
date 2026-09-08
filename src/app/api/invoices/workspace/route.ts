import { NextRequest } from "next/server";
import {
  OfficeAuthError,
  readOfficeSessionPayload,
  requireOfficeUser,
} from "@/lib/auth/office-session";
import {
  listProjectsForRole,
  userCanAccessProject,
} from "@/lib/auth/project-access";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const payload = await readOfficeSessionPayload();
    if (!payload) {
      throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
    }

    const user = await requireOfficeUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    const scopeParam = req.nextUrl.searchParams.get("scope");
    const listMode =
      scopeParam === "operational" || scopeParam === "all"
        ? ("all" as const)
        : ("assigned" as const);

    if (projectId) {
      const accessScope =
        scopeParam === "operational" ? "operational" : "manage";
      const allowed = await userCanAccessProject({
        userId: user.userId,
        role: user.role,
        projectId,
        scope: accessScope,
      });
      if (!allowed) {
        throw new OfficeAuthError("אין הרשאה לפרויקט זה", 403);
      }

      const result = await MeasurementSheetsRepository.getProjectTreeForOffice(
        projectId,
        payload.userId
      );
      if (result.status === "forbidden") {
        throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
      }
      if (result.status === "not_found") return apiError("פרויקט לא נמצא", 404);
      return apiSuccess(result.data);
    }

    const projects = await listProjectsForRole({
      userId: user.userId,
      role: user.role,
      mode: listMode,
    });

    return apiSuccess({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        contractNumber: p.contractNumber,
        contractor: p.contractor,
        location: p.location,
        status: p.status,
      })),
    });
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireOfficeUser();
    const body = await req.json();
    if (!body.projectId) return apiError("חסר פרויקט");
    if (!body.measurementAxisType) return apiError("חסר סוג יחידה");

    const allowed = await userCanAccessProject({
      userId: user.userId,
      role: user.role,
      projectId: String(body.projectId),
      scope: "manage",
    });
    if (!allowed) return apiError("אין הרשאה לפרויקט זה", 403);

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
