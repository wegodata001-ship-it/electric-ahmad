import { NextRequest } from "next/server";
import { ForemenRepository } from "@/repositories/foremen.repository";
import {
  requireOfficeAuth,
  requirePermission,
} from "@/lib/auth/assert-office";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOfficeAuth();
    const { id } = await params;
    const detail = await ForemenRepository.getDetail(id);
    if (!detail) return apiError("מנהל עבודה לא נמצא", 404);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requirePermission("manage_employees");
    const { id } = await params;
    const body = await request.json();

    if (body.action === "activate") {
      return apiSuccess(await ForemenRepository.setActive(id, true, userId));
    }
    if (body.action === "deactivate") {
      return apiSuccess(await ForemenRepository.setActive(id, false, userId));
    }

    const detail = await ForemenRepository.update(
      id,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        status: body.status,
        notes: body.notes,
        projectIds: body.projectIds,
      },
      userId
    );
    return apiSuccess(detail);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requirePermission("manage_employees");
    const { id } = await params;
    const detail = await ForemenRepository.softDelete(id, userId);
    return apiSuccess(detail);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
