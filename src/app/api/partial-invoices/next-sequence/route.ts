import { NextRequest } from "next/server";
import { PartialInvoicesRepository } from "@/repositories/partial-invoices.repository";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { formatBillingMonth } from "@/utils/invoice-calc";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) return apiError("מזהה פרויקט חובה");

    const project = await ProjectsRepository.findById(projectId);
    if (!project) return apiError("פרויקט לא נמצא", 404);

    const sequenceNumber =
      await PartialInvoicesRepository.nextSequence(projectId);

    return apiSuccess({
      sequenceNumber,
      billingMonth: formatBillingMonth(),
      displayLabel: `חשבון מספר ${sequenceNumber}`,
      project,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
