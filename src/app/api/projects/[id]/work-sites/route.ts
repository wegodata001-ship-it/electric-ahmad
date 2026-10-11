import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { ProjectWorkSitesRepository } from "@/repositories/project-work-sites.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOfficeUser();
    const { id } = await params;
    await requireProjectPermission("view_own", id);
    const items = await ProjectWorkSitesRepository.listForProject(id);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOfficeUser();
    const { id } = await params;
    await requireProjectPermission("create", id);
    const body = await request.json();
    if (!String(body.name ?? "").trim()) {
      return apiError("שם סניף חובה");
    }
    const site = await ProjectWorkSitesRepository.create(id, {
      name: String(body.name),
      address: body.address ?? null,
      contactName: body.contactName ?? null,
      status: body.status ?? "active",
    });
    return apiSuccess(site, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
