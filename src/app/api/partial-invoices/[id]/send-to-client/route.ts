import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canSendFinancialToClient,
  SEND_TO_CLIENT_FORBIDDEN_MESSAGE,
} from "@/lib/auth/financial-permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Marks invoice as sent to client — System Manager only. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireOfficeUser();
    if (!canSendFinancialToClient(user.role)) {
      return apiError(SEND_TO_CLIENT_FORBIDDEN_MESSAGE, 403);
    }
    const { id } = await params;
    await InvoiceApprovalsRepository.markSentToClient(id, user.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
