import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
    const approval = await InvoiceApprovalsRepository.sendForApproval(
      id,
      userId
    );
    return apiSuccess(approval);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
