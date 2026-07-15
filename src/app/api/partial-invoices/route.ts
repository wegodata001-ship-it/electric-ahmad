import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) {
      return apiSuccess(
        await PartialInvoicesRepository.findByProject(projectId)
      );
    }
    return apiSuccess(await PartialInvoicesRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const body = await request.json();

    const projectId = String(body.projectId ?? "");
    if (!projectId) return apiError("מזהה פרויקט חובה");

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return apiError("יש להוסיף לפחות סעיף אחד");

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
      },
      userId
    );

    return apiSuccess(invoice, 201);
  } catch (error) {
    if (error instanceof Error) {
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}
