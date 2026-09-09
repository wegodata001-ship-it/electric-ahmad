import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkOrderStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;
    const order = await WorkOrdersRepository.findById(id, session.foremanId);
    if (!order) return apiError("סידור עבודה לא נמצא", 404);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;
    const body = await req.json();
    if (body.projectId) {
      await assertProjectSelectable(String(body.projectId), session.foremanId);
    }

    const order = await WorkOrdersRepository.update(id, session.foremanId, {
      projectId: body.projectId ? String(body.projectId) : undefined,
      date: body.date ? new Date(body.date) : undefined,
      title: body.title,
      workArea: body.workArea,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      status: body.status as WorkOrderStatus | undefined,
      workers: Array.isArray(body.workers) ? body.workers : undefined,
      vehicles: Array.isArray(body.vehicles) ? body.vehicles : undefined,
      updatedById: session.userId,
    });

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;
    await WorkOrdersRepository.delete(id, session.foremanId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
