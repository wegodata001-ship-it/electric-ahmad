import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapEmployee } from "@/lib/mappers";
import { requirePermission } from "@/lib/auth/assert-office";
import { provisionFieldLoginForEmployee } from "@/lib/auth/create-field-manager";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Create real FIELD_MANAGER login for an existing foreman employee.
 * Body: { username, password }
 * Workers cannot receive a system user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("manage_employees");
    const { userId } = session;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { projectLinks: true, user: true },
    });
    if (!existing) return apiError("עובד לא נמצא", 404);

    if (existing.role === "worker") {
      return apiError("לעובדים אין משתמש מערכת — תיעוד בלבד", 400);
    }

    if (existing.userId || existing.user) {
      return apiSuccess({
        employee: mapEmployee(existing),
        alreadyLinked: true,
      });
    }

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return apiError("יש לספק username ו-password ליצירת התחברות");
    }

    const login = await provisionFieldLoginForEmployee(
      id,
      username,
      password,
      userId
    );

    const row = await prisma.employee.findUnique({
      where: { id },
      include: { projectLinks: true },
    });

    return apiSuccess({
      employee: mapEmployee(row!),
      login: {
        username: login.username,
        role: login.role,
        userId: login.userId,
      },
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
