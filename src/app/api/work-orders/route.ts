import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkOrderStatus } from "@prisma/client";

/** Office Operations — list / create work orders (same repository as Field) */
export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה", 403);
    }
    const status = req.nextUrl.searchParams.get("status") as WorkOrderStatus | null;
    const items = await WorkOrdersRepository.listAll({
      status: status || undefined,
      take: 80,
    });
    const queue = await WorkOrdersRepository.getOpsQueueCounts();
    return apiSuccess({ items, queue });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה", 403);
    }
    const body = await req.json();
    if (!body.projectId) return apiError("יש לבחור פרויקט");
    if (!body.foremanId) return apiError("יש לבחור מנהל עבודה");

    const order = await WorkOrdersRepository.create({
      projectId: String(body.projectId),
      foremanId: String(body.foremanId),
      date: body.date ? new Date(body.date) : new Date(),
      title: body.title,
      workArea: body.workArea,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      status: body.status || "assigned",
      workers: Array.isArray(body.workers) ? body.workers : [],
      vehicles: Array.isArray(body.vehicles) ? body.vehicles : [],
      createdById: session.userId,
    });

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
