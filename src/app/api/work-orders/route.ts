import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canApproveDocuments,
  hasDocumentPermission,
} from "@/lib/auth/document-permissions";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildPageInfo, parseListQuery } from "@/lib/api/list-query";
import type { WorkOrderStatus } from "@prisma/client";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";

/** Office — list / create work orders (Project Manager + Operations) */
export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה", 403);
    }
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") as WorkOrderStatus | null;
    const projectId = sp.get("projectId") || undefined;
    const foremanId = sp.get("foremanId") || undefined;
    const parsed = parseListQuery(sp, { defaultTake: 80, maxTake: 200 });
    if (projectId) {
      await requireProjectPermission("view_all", projectId, "operational");
    }
    const assignedProjects = await listProjectsForRole({
      userId: session.userId,
      role: session.role,
      mode: "assigned",
    });

    const fetched = await WorkOrdersRepository.listAll({
      status: status || undefined,
      projectId,
      projectIds:
        session.role === "PROJECT_MANAGER"
          ? assignedProjects.map((project) => project.id)
          : undefined,
      foremanId,
      take: parsed.take + 1,
      skip: parsed.skip,
    });
    const hasMore = fetched.length > parsed.take;
    const items = hasMore ? fetched.slice(0, parsed.take) : fetched;

    const pageInfo = buildPageInfo({
      take: parsed.take,
      skip: parsed.skip,
      page: parsed.page,
      fetchedCount: fetched.length,
      returnedCount: items.length,
    });

    const [queue, statusCounts] = await Promise.all([
      WorkOrdersRepository.getOpsQueueCounts(),
      WorkOrdersRepository.getStatusCounts({ projectId, foremanId }),
    ]);
    return apiSuccess({ items, pageInfo, queue, statusCounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "create")) {
      return apiError("אין הרשאה ליצירת סידור", 403);
    }
    const body = await req.json();
    if (!body.projectId) return apiError("יש לבחור פרויקט");
    await requireProjectPermission(
      "create",
      String(body.projectId),
      "operational"
    );
    if (!body.foremanId) return apiError("יש לבחור מנהל עבודה");

    const order = await WorkOrdersRepository.create({
      projectId: String(body.projectId),
      foremanId: String(body.foremanId),
      date: body.date ? new Date(body.date) : new Date(),
      title: body.title,
      workArea: body.workArea,
      clientName: body.clientName,
      address: body.address,
      notes: body.notes,
      status: body.status || "assigned",
      workers: Array.isArray(body.workers) ? body.workers : [],
      vehicles: Array.isArray(body.vehicles) ? body.vehicles : [],
      createdById: session.userId,
    });

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
