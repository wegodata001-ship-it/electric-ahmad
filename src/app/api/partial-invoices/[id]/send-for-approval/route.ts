import { after, NextRequest, NextResponse } from "next/server";
import {
  ApprovalSendError,
  InvoiceApprovalsRepository,
} from "@/repositories/invoice-approvals.repository";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await PartialInvoicesRepository.findById(id);
    if (!invoice) return apiError("חשבון לא נמצא", 404);
    const { userId } = await requireProjectPermission(
      "send_for_approval",
      invoice.projectId
    );
    const body = await request.json().catch(() => ({}));

    const approverUserIds: string[] = Array.isArray(body?.approverUserIds)
      ? body.approverUserIds.map(String)
      : body?.approverUserId
        ? [String(body.approverUserId)]
        : [];

    if (!approverUserIds.length) {
      return apiError("יש לבחור מנהל לאישור החשבון", 400);
    }

    const result = await InvoiceApprovalsRepository.sendForApproval(
      id,
      userId,
      {
        approverUserIds,
        createTask: body.createTask !== false,
        notifyInApp: body.notifyInApp !== false,
        sendWhatsApp: Boolean(body.sendWhatsApp),
        sendEmail: Boolean(body.sendEmail),
      },
      (task) => after(task)
    );
    const response = apiSuccess(result);
    response.headers.set(
      "Server-Timing",
      [
        `validation;dur=${result.performance.validationMs}`,
        `db;dur=${result.performance.transactionMs}`,
        `total;dur=${result.performance.totalMs}`,
      ].join(", ")
    );
    return response;
  } catch (error) {
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof ApprovalSendError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === "APPROVAL_ALREADY_PENDING" ? 409 : 400 }
      );
    }
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
