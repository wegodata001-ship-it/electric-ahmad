import { requireFieldManager } from "@/lib/auth/field-session";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { prisma } from "@/lib/prisma";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { roleGradeLabel } from "@/lib/auth/document-permissions";

export async function GET() {
  try {
    // Field managers need the list to pick approvers; office users too
    try {
      await requireFieldManager();
    } catch {
      await requireOfficeUser();
    }

    const users = await prisma.user.findMany({
      where: {
        passwordHash: { not: null },
        OR: [
          { role: "ADMIN" },
          { role: "admin" },
          { role: "מנהל מערכת" },
          { role: "PROJECT_MANAGER" },
          { role: "OPERATIONS_MANAGER" },
        ],
      },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });

    return apiSuccess({
      items: users
        .filter((u) => canApproveDocuments(u.role))
        .map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          roleLabel: roleGradeLabel(u.role),
          email: u.email,
        })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
