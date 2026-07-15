import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { FieldCrewRepository } from "@/repositories/field-crew.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireFieldManager();
    const list = await FieldCrewRepository.list(session.foremanId);
    return apiSuccess(list);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await request.json();
    const created = await FieldCrewRepository.create(
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
    return apiSuccess(created, 201);
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
