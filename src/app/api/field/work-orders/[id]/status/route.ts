import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { WorkOrderStatus } from "@prisma/client";

const ALLOWED: WorkOrderStatus[] = [
  "draft",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;
    const body = await req.json();
    const status = body.status as WorkOrderStatus;

    if (!ALLOWED.includes(status)) {
      return apiError("סטטוס לא תקין");
    }

    const order = await WorkOrdersRepository.setStatus(
      id,
      session.foremanId,
      status,
      session.userId
    );
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
