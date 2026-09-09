import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await PartialInvoicesRepository.findById(id);
    if (!invoice) return apiError("חשבון לא נמצא", 404);
    await requireProjectPermission("view_all", invoice.projectId);
    const approvals = await InvoiceApprovalsRepository.findByInvoice(id);
    return apiSuccess(approvals);
  } catch (error) {
    return handleApiError(error);
  }
}
