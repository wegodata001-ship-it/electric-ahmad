import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Office: list users allowed to approve invoices */
export async function GET(_req: NextRequest) {
  try {
    await requireOfficeUser();
    const items = await InvoiceApprovalsRepository.listApprovers();
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
