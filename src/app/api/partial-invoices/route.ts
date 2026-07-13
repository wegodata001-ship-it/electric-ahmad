import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) return apiSuccess(await PartialInvoicesRepository.findByProject(projectId));
    return apiSuccess(await PartialInvoicesRepository.findAll());
  } catch (error) {
    return handleApiError(error);
  }
}
