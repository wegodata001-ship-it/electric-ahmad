import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { FieldCrewTimeRepository } from "@/repositories/field-crew-time.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const [entries, summary] = await Promise.all([
      FieldCrewTimeRepository.listForMember(id, session.foremanId),
      FieldCrewTimeRepository.summaryForMember(id, session.foremanId),
    ]);
    return apiSuccess({ entries, summary });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { id } = await params;
    const body = await request.json();
    const entry = await FieldCrewTimeRepository.create(
      id,
      session.foremanId,
      {
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        notes: body.notes,
      },
      session.userId
    );
    const summary = await FieldCrewTimeRepository.summaryForMember(
      id,
      session.foremanId
    );
    return apiSuccess({ entry, summary });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
