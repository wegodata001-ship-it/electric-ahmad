import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const approverUserIds: string[] = Array.isArray(body?.approverUserIds)
      ? body.approverUserIds.map(String)
      : body?.approverUserId
        ? [String(body.approverUserId)]
        : [];

    if (!approverUserIds.length) {
      return apiError("יש לבחור מנהל לאישור החשבון", 400);
    }

    const result = await InvoiceApprovalsRepository.sendForApproval(id, userId, {
      approverUserIds,
      createTask: body.createTask !== false,
      notifyInApp: body.notifyInApp !== false,
      sendWhatsApp: Boolean(body.sendWhatsApp),
      sendEmail: Boolean(body.sendEmail),
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
