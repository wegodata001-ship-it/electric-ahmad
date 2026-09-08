import { requireTruckDriver } from "@/lib/auth/driver-session";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Minimal project picker for drivers — id + name only */
export async function GET() {
  try {
    await requireTruckDriver();
    const projects = await prisma.project.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
      take: 200,
    });
    return apiSuccess({ items: projects });
  } catch (error) {
    return handleApiError(error);
  }
}
