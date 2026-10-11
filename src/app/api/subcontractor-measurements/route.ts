import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET(req: NextRequest) {
  try {
    await requireOfficeAuth();
    const items = await SubcontractorsRepository.listMeasurements({
      subcontractorId: req.nextUrl.searchParams.get("subcontractorId") || undefined,
      projectId: req.nextUrl.searchParams.get("projectId") || undefined,
      status: req.nextUrl.searchParams.get("status") || undefined,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSubcontractorOfficeAction("review_measurements");
    const body = await req.json();
    const data = await SubcontractorsRepository.createMeasurement(
      {
        assignmentId: String(body.assignmentId),
        notes: body.notes,
        items: body.items ?? [],
      },
      { userId: session.userId }
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
