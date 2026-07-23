import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { InvoiceApprovalsRepository } from "@/repositories/invoice-approvals.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Office: list users allowed to approve invoices / measurement sheets */
export async function GET(req: NextRequest) {
  try {
    await requireOfficeUser();
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
