import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { peekNextDocumentNumber } from "@/lib/documents/sequences";
import type { WorkDiaryStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const status = req.nextUrl.searchParams.get("status") as WorkDiaryStatus | null;
    const peek = req.nextUrl.searchParams.get("peekNumber");
    if (peek === "1") {
      const documentNumber = await peekNextDocumentNumber("work_diary");
      return apiSuccess({ documentNumber });
    }
    const items = await WorkDiariesRepository.list({
      foremanId: session.foremanId,
      status: status || undefined,
      take: 50,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await req.json();
    if (!body.projectId) return apiError("יש לבחור פרויקט");

    const diary = await WorkDiariesRepository.create({
      projectId: String(body.projectId),
      foremanId: session.foremanId,
      workDate: body.workDate ? new Date(body.workDate) : new Date(),
      workTime: body.workTime,
      weather: body.weather,
      workType: body.workType,
      workSummary: body.workSummary,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      workItems: Array.isArray(body.workItems) ? body.workItems : [],
      workers: Array.isArray(body.workers) ? body.workers : [],
      equipment: Array.isArray(body.equipment) ? body.equipment : [],
      materials: Array.isArray(body.materials) ? body.materials : [],
      foremanSignatureUrl: body.foremanSignatureUrl,
      foremanSignedName: body.foremanSignedName ?? session.foremanName,
      createdById: session.userId,
    });

    return apiSuccess(diary, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
