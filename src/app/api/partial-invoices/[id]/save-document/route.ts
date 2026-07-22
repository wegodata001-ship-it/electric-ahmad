import { NextRequest } from "next/server";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** שמירת חשבון כ-PDF במסמכי הפרויקט (תיקיית חשבונות) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
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
