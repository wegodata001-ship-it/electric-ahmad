import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** שמירת חשבון כ-PDF במסמכי הפרויקט (תיקיית חשבונות) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await PartialInvoicesRepository.findById(id);
    if (!invoice) throw new Error("חשבון לא נמצא");
    const { userId } = await requireProjectPermission(
      "create",
      invoice.projectId
    );
    const origin = request.nextUrl.origin;
    const result = await InvoiceApprovalsRepository.saveInvoiceDocument(
      id,
      userId,
      origin
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
