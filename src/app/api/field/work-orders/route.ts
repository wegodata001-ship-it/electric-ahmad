import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkOrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const status = req.nextUrl.searchParams.get("status") as WorkOrderStatus | null;
    const items = await WorkOrdersRepository.listForForeman(session.foremanId, {
      status: status || undefined,
      take: 50,
    });
    const counts = await WorkOrdersRepository.getDashboardCounts(session.foremanId);
    return apiSuccess({ items, counts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await req.json();

    if (!body.projectId) return apiError("יש לבחור פרויקט");
    await assertProjectSelectable(String(body.projectId), session.foremanId);

    const order = await WorkOrdersRepository.create({
      projectId: String(body.projectId),
      foremanId: session.foremanId,
      date: body.date ? new Date(body.date) : new Date(),
      title: body.title,
      workArea: body.workArea,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      status: body.status,
      workers: Array.isArray(body.workers) ? body.workers : [],
      vehicles: Array.isArray(body.vehicles) ? body.vehicles : [],
      createdById: session.userId,
    });

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
