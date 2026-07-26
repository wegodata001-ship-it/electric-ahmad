import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canApproveDocuments,
  hasDocumentPermission,
} from "@/lib/auth/document-permissions";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildPageInfo, parseListQuery } from "@/lib/api/list-query";
import type { WorkDiaryStatus } from "@prisma/client";

/** Office — list / create work diaries (Project Manager portal) */
export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה", 403);
    }
    const sp = req.nextUrl.searchParams;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status") as WorkDiaryStatus | null;
    const parsed = parseListQuery(sp, { defaultTake: 80, maxTake: 200 });

    // Fetch take+1 to detect hasMore without a separate count query.
    const fetched = await WorkDiariesRepository.list({
      projectId,
      status: status || undefined,
      take: parsed.take + 1,
      skip: parsed.skip,
    });
    const hasMore = fetched.length > parsed.take;
    const items = hasMore ? fetched.slice(0, parsed.take) : fetched;

    const pageInfo = buildPageInfo({
      take: parsed.take,
      skip: parsed.skip,
      page: parsed.page,
      fetchedCount: fetched.length,
      returnedCount: items.length,
    });

    return apiSuccess({ items, pageInfo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "create")) {
      return apiError("אין הרשאה ליצירת יומן", 403);
    }
    const body = await req.json();
    if (!body.projectId) return apiError("יש לבחור פרויקט");
    if (!body.foremanId) return apiError("יש לבחור מנהל עבודה");

    const diary = await WorkDiariesRepository.create({
      projectId: String(body.projectId),
      foremanId: String(body.foremanId),
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
      foremanSignedName: body.foremanSignedName,
      createdById: session.userId,
    });

    return apiSuccess(diary, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
