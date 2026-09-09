import { NextRequest } from "next/server";
import {
  ApprovalDecisionError,
  InvoiceApprovalsRepository,
} from "@/repositories/invoice-approvals.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Future manager workspace endpoint — ready, no manager UI yet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { approvalId } = await params;
    const body = await request.json().catch(() => ({}));
    const comment = typeof body.comment === "string" ? body.comment : "";
    const approval = await InvoiceApprovalsRepository.reject(
      approvalId,
      userId,
      comment
    );
    return apiSuccess(approval);
  } catch (error) {
    if (error instanceof ApprovalDecisionError) {
      return apiError(error.message, error.status);
    }
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
