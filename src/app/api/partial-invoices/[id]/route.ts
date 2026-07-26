import { NextRequest } from "next/server";
import {
  PartialInvoicesRepository,
  type UpdatePartialInvoiceInput,
} from "@/repositories/partial-invoices.repository";
import { getAuthContext } from "@/lib/auth/session";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody, ValidationError } from "@/lib/validation/parse-body";
import { partialInvoicePatchSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOfficeAuth();
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
    const body = await parseJsonBody(request, partialInvoicePatchSchema);
    // Zod validates the wire payload; the repository accepts a slightly
    // narrower shape for status/items so we cast at the boundary to keep the
    // previous untyped behaviour without weakening validation elsewhere.
    const update = {
      date: body.date,
      dueDate: body.dueDate,
      billingMonth: body.billingMonth,
      billTo: body.billTo,
      contractor: body.contractor,
      notes: body.notes,
      status: body.status,
      items: Array.isArray(body.items) ? body.items : [],
    } as unknown as UpdatePartialInvoiceInput;
    const invoice = await PartialInvoicesRepository.update(id, update, userId);
    return apiSuccess(invoice);
  } catch (error) {
    if (error instanceof ValidationError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
