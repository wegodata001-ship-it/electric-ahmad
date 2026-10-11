import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    const items = await SubcontractorsRepository.listMeasurements({
      subcontractorId: session.subcontractorId,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSubcontractorUser();
    const body = await req.json();
    const created = await SubcontractorsRepository.createMeasurement(
      {
        assignmentId: String(body.assignmentId),
        notes: body.notes,
        items: body.items ?? [],
      },
      { userId: session.userId, subcontractorId: session.subcontractorId }
    );
    if (body.submit) {
      return apiSuccess(
        await SubcontractorsRepository.submitMeasurement(
          created.id,
          session.userId,
          session.subcontractorId
        )
      );
    }
    return apiSuccess(created);
  } catch (error) {
    return handleApiError(error);
  }
}
