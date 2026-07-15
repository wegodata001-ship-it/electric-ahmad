import { NextRequest } from "next/server";
import { BoqExecutionsRepository } from "@/repositories/boq-executions.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { ExecutionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const boqItemId = request.nextUrl.searchParams.get("boqItemId");
    if (!boqItemId) return apiError("מזהה סעיף חובה");
    return apiSuccess(await BoqExecutionsRepository.findByBoqItem(boqItemId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();

    if (!body.projectId || !body.boqItemId || !body.employeeId) {
      return apiError("פרויקט, סעיף ועובד חובה");
    }

    const execution = await BoqExecutionsRepository.create(
      {
        projectId: String(body.projectId),
        boqItemId: String(body.boqItemId),
        employeeId: String(body.employeeId),
        foremanId: body.foremanId || null,
        quantity: Number(body.quantity),
        executedAt: body.executedAt,
        status: body.status as ExecutionStatus | undefined,
        notes: body.notes,
        source: body.source ?? "office",
      },
      userId
    );

    return apiSuccess(execution, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
