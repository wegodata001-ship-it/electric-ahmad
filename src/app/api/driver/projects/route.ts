import { NextRequest } from "next/server";
import { requireTruckDriver } from "@/lib/auth/driver-session";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Minimal project picker for drivers — id + name + site details. */
export async function GET(req: NextRequest) {
  try {
    await requireTruckDriver();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (projectId) {
      const items = await prisma.boqItem.findMany({
        where: { projectId, deletedAt: null, status: "active" },
        select: { id: true, description: true, unit: true },
        orderBy: { code: "asc" },
        take: 40,
      });
      return apiSuccess({ items });
    }

    const projects = await prisma.project.findMany({
      where: { status: "active", deletedAt: null },
      select: {
        id: true,
        name: true,
        location: true,
        contractor: true,
      },
      orderBy: { name: "asc" },
      take: 200,
    });
    return apiSuccess({ items: projects });
  } catch (error) {
    return handleApiError(error);
  }
}
