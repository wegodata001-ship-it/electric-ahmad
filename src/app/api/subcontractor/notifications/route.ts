import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    const items = await prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return apiSuccess({
      items: items.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.read,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
