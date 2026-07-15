import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { FieldCrewRepository } from "@/repositories/field-crew.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const body = await request.json();
    const updated = await FieldCrewRepository.update(
      id,
      session.foremanId,
      {
        name: body.name,
        phone: body.phone,
        profession: body.profession,
        status: body.status,
        notes: body.notes,
      },
      session.userId
    );
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    await FieldCrewRepository.remove(id, session.foremanId, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
