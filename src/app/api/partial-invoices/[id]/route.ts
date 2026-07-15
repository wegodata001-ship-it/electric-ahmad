import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await PartialInvoicesRepository.findById(id);
    if (!invoice) return apiError("חשבון לא נמצא", 404);
    return apiSuccess(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
    const body = await request.json();
    const invoice = await PartialInvoicesRepository.update(
      id,
      {
        date: body.date,
        dueDate: body.dueDate,
        billingMonth: body.billingMonth,
        billTo: body.billTo,
        contractor: body.contractor,
        notes: body.notes,
        status: body.status,
        items: Array.isArray(body.items) ? body.items : [],
      },
      userId
    );
    return apiSuccess(invoice);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
