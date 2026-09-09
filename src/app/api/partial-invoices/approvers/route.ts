import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/assert-office";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Office: list users allowed to approve invoices / measurement sheets */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("send_for_approval");
    const includeFieldManagers =
      req.nextUrl.searchParams.get("includeFieldManagers") === "1" ||
      req.nextUrl.searchParams.get("for") === "measurement";
    const items = await InvoiceApprovalsRepository.listApprovers({
      includeFieldManagers,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
