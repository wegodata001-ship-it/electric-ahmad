import { NextRequest } from "next/server";
import {
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { prisma } from "@/lib/prisma";
import { FieldCrewTimeRepository } from "@/repositories/field-crew-time.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { entryId } = await params;
    const body = await request.json();
    const entry = await FieldCrewTimeRepository.update(
      entryId,
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
      entry.crewMemberId,
      session.foremanId
    );
    return apiSuccess({ entry, summary });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const session = await requireFieldManager();
    const { entryId } = await params;
    const row = await prisma.fieldCrewTimeEntry.findUnique({
      where: { id: entryId },
    });
    if (!row || row.managerId !== session.foremanId) {
      return apiError("רישום לא נמצא", 404);
    }
    await FieldCrewTimeRepository.remove(
      entryId,
      session.foremanId,
      session.userId
    );
    const summary = await FieldCrewTimeRepository.summaryForMember(
      row.crewMemberId,
      session.foremanId
    );
    return apiSuccess({ ok: true, summary, crewMemberId: row.crewMemberId });
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
