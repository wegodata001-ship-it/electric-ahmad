import { NextRequest } from "next/server";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();

    if (!body.name?.trim()) return apiError("שם פרויקט חובה");
    if (!body.contractNumber?.trim()) return apiError("מספר חוזה חובה");
    if (!body.contractor?.trim()) return apiError("שם קבלן חובה");
    if (!body.location?.trim()) return apiError("מיקום חובה");

    const contractValue = Number(body.contractValue);
    if (!contractValue || contractValue <= 0) {
      return apiError("שווי חוזה חייב להיות גדול מ-0");
    }

    const project = await ProjectsRepository.create(
      {
        name: body.name.trim(),
        contractNumber: body.contractNumber.trim(),
        contractor: body.contractor.trim(),
        location: body.location.trim(),
        foremanName: body.foremanName?.trim() || "מנהל עבודה",
        foremanId: body.foremanId,
        contractValue,
        description: body.description?.trim(),
        status: body.status ?? "planning",
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
      userId
    );

    return apiSuccess(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
