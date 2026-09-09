import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { OfficeAuthError } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("view_all");
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) {
      await requireProjectPermission("view_all", projectId);
      return apiSuccess(
        await PartialInvoicesRepository.findByProject(projectId)
      );
    }
    const projects = await listProjectsForRole({
      userId: user.userId,
      role: user.role,
      mode: "assigned",
    });
    return apiSuccess(
      await PartialInvoicesRepository.findAll(
        user.role === "PROJECT_MANAGER"
          ? projects.map((project) => project.id)
          : undefined
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const projectId = String(body.projectId ?? "");
    if (!projectId) return apiError("מזהה פרויקט חובה");
    const { userId } = await requireProjectPermission("create", projectId);

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return apiError("יש להוסיף לפחות סעיף אחד");

    const reportIds = Array.isArray(body.reportIds)
      ? body.reportIds.map((id: unknown) => String(id)).filter(Boolean)
      : undefined;

    const invoice = await PartialInvoicesRepository.create(
      {
        projectId,
        date: body.date,
        dueDate: body.dueDate,
        billingMonth: body.billingMonth,
        billTo: body.billTo,
        contractor: body.contractor,
        notes: body.notes,
        status: body.status,
        items: items.map(
          (item: { boqItemId: string; quantity: number }) => ({
            boqItemId: String(item.boqItemId),
            quantity: Number(item.quantity),
          })
        ),
        reportIds,
      },
      userId
    );

    return apiSuccess(invoice, 201);
  } catch (error) {
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) {
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}
