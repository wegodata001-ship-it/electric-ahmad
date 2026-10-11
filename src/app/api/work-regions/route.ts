import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireSystemAdmin } from "@/lib/auth/assert-office";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { WorkRegionsRepository } from "@/repositories/work-regions.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireOfficeUser();
    const items = await WorkRegionsRepository.list(isSystemAdminRole(session.role));
    return apiSuccess({ items, canManage: isSystemAdminRole(session.role) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const body = await request.json();
    if (!String(body.name ?? "").trim()) return apiError("שם אזור חובה");
    const item = await WorkRegionsRepository.create({
      name: String(body.name),
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
    });
    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
