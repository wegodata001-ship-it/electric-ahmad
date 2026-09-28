import { requireOfficeUser } from "@/lib/auth/office-session";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireOfficeUser();
    if (!canAssignProjectManager(user.role)) {
      return apiError("אין הרשאה לצפייה ברשימת מנהלי פרויקט", 403);
    }

    const items = await prisma.user.findMany({
      where: {
        role: PROJECT_MANAGER_ROLE,
        archivedAt: null,
        status: "ACTIVE",
        passwordHash: { not: null },
      },
      select: { id: true, name: true, username: true, status: true },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
