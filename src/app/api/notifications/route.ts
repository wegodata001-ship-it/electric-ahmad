import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { getCurrentUser } from "@/lib/auth/session";
import { NotificationsRepository } from "@/repositories/dashboard.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

async function resolveNotificationUserId(): Promise<string> {
  try {
    const user = await getCurrentUser();
    return user.dbId;
  } catch {
    const session = await requireFieldManager();
    return session.userId;
  }
}

export async function GET() {
  try {
    const userId = await resolveNotificationUserId();
    return apiSuccess(await NotificationsRepository.findAll(userId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await resolveNotificationUserId();
    const body = await request.json();

    if (body.all) {
      await NotificationsRepository.markAllAsRead(userId);
    } else if (body.id) {
      await NotificationsRepository.markAsRead(body.id);
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
