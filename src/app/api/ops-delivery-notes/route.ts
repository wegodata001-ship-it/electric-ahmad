import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canApproveDocuments,
  hasDocumentPermission,
} from "@/lib/auth/document-permissions";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildPageInfo, parseListQuery } from "@/lib/api/list-query";
import type { OpsDeliveryNoteStatus } from "@prisma/client";

/** Office — list / create ops delivery notes */
export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה", 403);
    }
    const sp = req.nextUrl.searchParams;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status") as OpsDeliveryNoteStatus | null;
    const parsed = parseListQuery(sp, { defaultTake: 80, maxTake: 200 });

    const fetched = await OpsDeliveryNotesRepository.list({
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
      return apiError("אין הרשאה ליצירת תעודת משלוח", 403);
    }
    const body = await req.json();
    if (!body.foremanId) return apiError("יש לבחור מנהל עבודה / מוסר");
    if (!body.clientName?.trim()) return apiError("יש להזין שם לקוח");

    const note = await OpsDeliveryNotesRepository.create({
      projectId: body.projectId ? String(body.projectId) : null,
      foremanId: String(body.foremanId),
      noteDate: body.noteDate ? new Date(body.noteDate) : new Date(),
      clientName: String(body.clientName).trim(),
      address: body.address,
      vehicleNumber: body.vehicleNumber,
      driverName: body.driverName,
      notes: body.notes,
      items: Array.isArray(body.items) ? body.items : [],
      createdById: session.userId,
    });

    return apiSuccess(note, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
