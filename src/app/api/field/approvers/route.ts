import { requireFieldManager } from "@/lib/auth/field-session";
import { prisma } from "@/lib/prisma";
import { canApproveDocuments, roleGradeLabel } from "@/lib/auth/document-permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Field managers pick approvers when submitting a document */
export async function GET() {
  try {
    await requireFieldManager();

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
