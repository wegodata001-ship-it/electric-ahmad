import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
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
