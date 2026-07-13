import { NextRequest } from "next/server";
import { NotificationsRepository } from "@/repositories/dashboard.repository";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return apiSuccess(await NotificationsRepository.findAll(user.dbId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();

    if (body.all) {
      await NotificationsRepository.markAllAsRead(user.dbId);
    } else if (body.id) {
      await NotificationsRepository.markAsRead(body.id);
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
