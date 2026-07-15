import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const approvals = await InvoiceApprovalsRepository.findByInvoice(id);
    return apiSuccess(approvals);
  } catch (error) {
    return handleApiError(error);
  }
}
